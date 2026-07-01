import { Agent, getAgentByName, routeAgentRequest } from "agents";

import { decryptJson, encryptJson, signJson, stableHash, verifySignedJson } from "./crypto";
import type { EncryptedJson } from "./crypto";
import {
  AGENT_GOOGLE_HEALTH_SCOPES,
  assertDataPointMatchesDataType,
  batchDeleteDataPoints,
  buildExerciseDataPoint,
  buildSleepDataPoint,
  buildStepsDataPoint,
  buildWeightDataPoint,
  createDataPoint,
  dataPointName,
  exchangeGoogleCode,
  fetchHealthContext,
  listDataPoints,
  patchDataPoint,
  refreshGoogleAccessToken,
  rollUpDataPoints
} from "./google-health";
import type { GoogleHealthDataPoint, GoogleTokenResponse } from "./google-health";
import {
  emptyResponse,
  errorResponse,
  handleOptions,
  HttpError,
  isAllowedReturnTo,
  jsonResponse,
  readJson,
  requireBearerAuth,
  requireInternalAuth,
  withCors
} from "./http";

type StoredRefreshToken = {
  refreshToken: string;
  scope?: string;
  tokenType?: string;
};

type AppEnv = Env & {
  GOOGLE_CLIENT_SECRET: string;
  HEALTH_AGENT_API_TOKEN: string;
  OAUTH_STATE_SECRET?: string;
  TOKEN_ENCRYPTION_KEY: string;
};

type HealthAgentState = {
  google?: {
    connectedAt: string;
    refreshToken: EncryptedJson;
    scope?: string;
  };
};

type LedgerRow = {
  client_record_id: string;
  created_at: string;
  data_type: string;
  google_name: string;
  id: string;
  operation_json: string | null;
  payload_json: string | null;
  status: "active" | "deleted";
  updated_at: string;
};

type OAuthState = {
  createdAt: number;
  nonce: string;
  returnTo?: string;
  userId: string;
};

const DEFAULT_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_OAUTH_STATE_AGE_MS = 10 * 60 * 1000;

export class FittyHealthAgent extends Agent<AppEnv, HealthAgentState> {
  initialState: HealthAgentState = {};

  async onStart(): Promise<void> {
    this.sql`
      CREATE TABLE IF NOT EXISTS owned_google_records (
        id TEXT PRIMARY KEY,
        data_type TEXT NOT NULL,
        google_name TEXT NOT NULL UNIQUE,
        client_record_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        payload_json TEXT,
        operation_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    this.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_owned_google_records_client
      ON owned_google_records (data_type, client_record_id)
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_owned_google_records_status
      ON owned_google_records (status)
    `;
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, this.env);
    }

    try {
      const path = agentSubpath(new URL(request.url).pathname);

      if (request.method === "POST" && path === "/internal/connect-google") {
        await requireInternalAuth(request, this.env);
        const body = await readJson<GoogleTokenResponse>(request);
        return jsonResponse(await this.storeGoogleToken(body), request, this.env);
      }

      await requireBearerAuth(request, this.env);

      if (request.method === "GET" && path === "/status") {
        return jsonResponse(this.status(), request, this.env);
      }

      if (request.method === "POST" && path === "/connect") {
        const body = await readJson<{ refreshToken: string; scope?: string; tokenType?: string }>(request);
        return jsonResponse(
          await this.storeGoogleToken({
            access_token: "",
            refresh_token: body.refreshToken,
            scope: body.scope,
            token_type: body.tokenType
          }),
          request,
          this.env
        );
      }

      if (request.method === "POST" && path === "/ask") {
        return jsonResponse(await this.answerQuestion(await readJson(request)), request, this.env);
      }

      if (request.method === "POST" && path === "/snapshot") {
        return jsonResponse(await this.snapshot(await readJson(request)), request, this.env);
      }

      if (request.method === "POST" && path === "/data-points/list") {
        return jsonResponse(await this.listDataPoints(await readJson(request)), request, this.env);
      }

      if (request.method === "POST" && path === "/data-points/rollup") {
        return jsonResponse(await this.rollup(await readJson(request)), request, this.env);
      }

      if (request.method === "POST" && path === "/data-points/create") {
        return jsonResponse(await this.createOwnedDataPoint(await readJson(request)), request, this.env, { status: 201 });
      }

      if (request.method === "PATCH" && path === "/data-points") {
        return jsonResponse(await this.patchOwnedDataPoint(await readJson(request)), request, this.env);
      }

      if (request.method === "DELETE" && path === "/data-points") {
        return jsonResponse(await this.deleteOwnedDataPoints(await readJson(request)), request, this.env);
      }

      if (request.method === "POST" && path === "/weight") {
        const body = await readJson<Record<string, unknown>>(request);
        return jsonResponse(
          await this.createOwnedDataPoint({
            clientRecordId: stringValue(body.clientRecordId),
            dataPoint: buildWeightDataPoint({
              measuredAt: stringValue(body.measuredAt),
              notes: stringValue(body.notes),
              utcOffset: stringValue(body.utcOffset),
              weightGrams: numberValue(body.weightGrams),
              weightKg: numberValue(body.weightKg)
            }),
            dataType: "weight"
          }),
          request,
          this.env,
          { status: 201 }
        );
      }

      if (request.method === "POST" && path === "/steps") {
        const body = await readJson<{
          clientRecordId?: string;
          count: number;
          endTime: string;
          endUtcOffset?: string;
          startTime: string;
          startUtcOffset?: string;
        }>(request);
        return jsonResponse(
          await this.createOwnedDataPoint({
            clientRecordId: body.clientRecordId,
            dataPoint: buildStepsDataPoint(body),
            dataType: "steps"
          }),
          request,
          this.env,
          { status: 201 }
        );
      }

      if (request.method === "POST" && path === "/sleep") {
        const body = await readJson<Parameters<typeof buildSleepDataPoint>[0] & { clientRecordId?: string }>(request);
        return jsonResponse(
          await this.createOwnedDataPoint({
            clientRecordId: body.clientRecordId,
            dataPoint: buildSleepDataPoint(body),
            dataType: "sleep"
          }),
          request,
          this.env,
          { status: 201 }
        );
      }

      if (request.method === "POST" && path === "/exercise") {
        const body = await readJson<Parameters<typeof buildExerciseDataPoint>[0] & { clientRecordId?: string }>(request);
        return jsonResponse(
          await this.createOwnedDataPoint({
            clientRecordId: body.clientRecordId,
            dataPoint: buildExerciseDataPoint(body),
            dataType: "exercise"
          }),
          request,
          this.env,
          { status: 201 }
        );
      }

      throw new HttpError(404, "Not found");
    } catch (error) {
      return errorResponse(error, request, this.env);
    }
  }

  private status(): Record<string, unknown> {
    const [active] = this.sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM owned_google_records WHERE status = 'active'
    `;
    const [deleted] = this.sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM owned_google_records WHERE status = 'deleted'
    `;

    return {
      connected: Boolean(this.state.google),
      googleScope: this.state.google?.scope,
      lastConnectedAt: this.state.google?.connectedAt,
      ownedRecords: {
        active: active?.count ?? 0,
        deleted: deleted?.count ?? 0
      }
    };
  }

  private async storeGoogleToken(token: GoogleTokenResponse): Promise<Record<string, unknown>> {
    const refreshToken = token.refresh_token;
    if (!refreshToken) {
      throw new HttpError(400, "Google OAuth did not return a refresh token. Re-run consent with prompt=consent.");
    }
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
    }

    const stored: StoredRefreshToken = {
      refreshToken,
      scope: token.scope,
      tokenType: token.token_type
    };

    this.setState({
      ...this.state,
      google: {
        connectedAt: new Date().toISOString(),
        refreshToken: await encryptJson(stored, this.env.TOKEN_ENCRYPTION_KEY),
        scope: token.scope
      }
    });

    return {
      connected: true,
      scope: token.scope
    };
  }

  private async getAccessToken(): Promise<string> {
    if (!this.state.google) {
      throw new HttpError(409, "Google Health is not connected for this agent instance");
    }
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
    }

    const stored = await decryptJson<StoredRefreshToken>(this.state.google.refreshToken, this.env.TOKEN_ENCRYPTION_KEY);
    const refreshed = await refreshGoogleAccessToken(this.env, stored.refreshToken);

    if (refreshed.refresh_token && refreshed.refresh_token !== stored.refreshToken) {
      await this.storeGoogleToken(refreshed);
    }

    return refreshed.access_token;
  }

  private async answerQuestion(body: unknown): Promise<Record<string, unknown>> {
    const input = body as { days?: number; question?: string };
    const question = input.question?.trim();
    if (!question) {
      throw new HttpError(400, "question is required");
    }
    if (question.length > 4000) {
      throw new HttpError(400, "question is too long");
    }

    const days = clampDays(input.days, 30);
    const context = await fetchHealthContext(await this.getAccessToken(), { days });
    const model = this.env.AI_MODEL || DEFAULT_AI_MODEL;
    const result = await this.env.AI.run(model, {
      messages: [
        {
          content:
            "You answer questions about the user's Google Health data. Use only the provided data. Be concise and quantitative. Do not diagnose, prescribe, or claim medical certainty. If the data is missing or an API call failed, say so clearly.",
          role: "system"
        },
        {
          content: `Question: ${question}\n\nGoogle Health data JSON:\n${JSON.stringify(context).slice(0, 24000)}`,
          role: "user"
        }
      ]
    });

    return {
      answer: extractAiText(result),
      dataWindow: (context as { range?: unknown }).range,
      model
    };
  }

  private async snapshot(body: unknown): Promise<Record<string, unknown>> {
    const input = body as { days?: number };
    return fetchHealthContext(await this.getAccessToken(), { days: clampDays(input.days, 30) });
  }

  private async listDataPoints(body: unknown): Promise<Record<string, unknown>> {
    const input = body as { dataType?: string; filter?: string; pageSize?: number; pageToken?: string };
    const dataType = requireDataType(input.dataType);
    return listDataPoints(await this.getAccessToken(), dataType, {
      filter: input.filter,
      pageSize: input.pageSize,
      pageToken: input.pageToken
    });
  }

  private async rollup(body: unknown): Promise<Record<string, unknown>> {
    const input = body as {
      dataType?: string;
      endTime?: string;
      pageSize?: number;
      startTime?: string;
      windowSize?: string;
    };
    const dataType = requireDataType(input.dataType);
    if (!input.startTime || !input.endTime) {
      throw new HttpError(400, "startTime and endTime are required");
    }

    return rollUpDataPoints(await this.getAccessToken(), dataType, {
      endTime: input.endTime,
      pageSize: input.pageSize,
      startTime: input.startTime,
      windowSize: input.windowSize
    });
  }

  private async createOwnedDataPoint(body: unknown): Promise<Record<string, unknown>> {
    const input = body as {
      clientRecordId?: string;
      dataPoint?: GoogleHealthDataPoint;
      dataType?: string;
    };
    const dataType = requireDataType(input.dataType);
    const dataPoint = requireDataPoint(input.dataPoint);
    const clientRecordId = await normalizeClientRecordId(input.clientRecordId);
    const existing = this.findActiveRecordByClientRecordId(dataType, clientRecordId);

    if (existing) {
      return {
        idempotent: true,
        record: publicLedgerRecord(existing)
      };
    }

    const googleName = dataPointName(dataType, clientRecordId);
    const accessToken = await this.getAccessToken();
    const payload = { ...dataPoint, name: googleName };
    const operation = await createDataPoint(accessToken, dataType, payload);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    this.sql`
      INSERT INTO owned_google_records
        (id, data_type, google_name, client_record_id, status, payload_json, operation_json, created_at, updated_at)
      VALUES
        (${id}, ${dataType}, ${googleName}, ${clientRecordId}, 'active', ${JSON.stringify(payload)}, ${JSON.stringify(operation)}, ${now}, ${now})
    `;

    return {
      operation,
      record: {
        clientRecordId,
        dataType,
        googleName,
        id,
        status: "active"
      }
    };
  }

  private async patchOwnedDataPoint(body: unknown): Promise<Record<string, unknown>> {
    const input = body as {
      clientRecordId?: string;
      dataPoint?: GoogleHealthDataPoint;
      dataType?: string;
      name?: string;
    };
    const dataType = requireDataType(input.dataType);
    const dataPoint = requireDataPoint(input.dataPoint);
    assertDataPointMatchesDataType(dataType, dataPoint);
    const record = this.findOwnedRecord(dataType, input);
    const payload = { ...dataPoint, name: record.google_name };
    const operation = await patchDataPoint(await this.getAccessToken(), record.google_name, payload);
    const now = new Date().toISOString();

    this.sql`
      UPDATE owned_google_records
      SET payload_json = ${JSON.stringify(payload)}, operation_json = ${JSON.stringify(operation)}, updated_at = ${now}
      WHERE id = ${record.id}
    `;

    return {
      operation,
      record: publicLedgerRecord({ ...record, payload_json: JSON.stringify(payload), updated_at: now })
    };
  }

  private async deleteOwnedDataPoints(body: unknown): Promise<Record<string, unknown>> {
    const input = body as {
      clientRecordIds?: string[];
      dataType?: string;
      names?: string[];
    };

    const records = this.findOwnedRecordsForDelete(input);
    if (!records.length) {
      throw new HttpError(404, "No active app-owned records matched the delete request");
    }

    const requestedCount = (input.names?.length ?? 0) + (input.clientRecordIds?.length ?? 0);
    if (requestedCount && records.length !== requestedCount) {
      throw new HttpError(403, "Delete requests may only target app-owned active Google Health records");
    }

    const dataTypes = [...new Set(records.map((record) => record.data_type))];
    const parentDataType = dataTypes.length === 1 ? dataTypes[0] : "-";
    const names = records.map((record) => record.google_name);
    const operation = await batchDeleteDataPoints(await this.getAccessToken(), parentDataType, names);
    const now = new Date().toISOString();

    for (const record of records) {
      this.sql`
        UPDATE owned_google_records
        SET status = 'deleted', operation_json = ${JSON.stringify(operation)}, updated_at = ${now}
        WHERE id = ${record.id}
      `;
    }

    return {
      deleted: records.map(publicLedgerRecord),
      operation
    };
  }

  private findActiveRecordByClientRecordId(dataType: string, clientRecordId: string): LedgerRow | undefined {
    const [record] = this.sql<LedgerRow>`
      SELECT * FROM owned_google_records
      WHERE data_type = ${dataType} AND client_record_id = ${clientRecordId} AND status = 'active'
      LIMIT 1
    `;
    return record;
  }

  private findOwnedRecord(
    dataType: string,
    input: {
      clientRecordId?: string;
      name?: string;
    }
  ): LedgerRow {
    const record = input.name
      ? this.sql<LedgerRow>`
          SELECT * FROM owned_google_records
          WHERE data_type = ${dataType} AND google_name = ${input.name} AND status = 'active'
          LIMIT 1
        `[0]
      : input.clientRecordId
        ? this.sql<LedgerRow>`
            SELECT * FROM owned_google_records
            WHERE data_type = ${dataType} AND client_record_id = ${input.clientRecordId} AND status = 'active'
            LIMIT 1
          `[0]
        : undefined;

    if (!record) {
      throw new HttpError(403, "This record is not an active app-owned Google Health record");
    }

    return record;
  }

  private findOwnedRecordsForDelete(input: {
    clientRecordIds?: string[];
    dataType?: string;
    names?: string[];
  }): LedgerRow[] {
    const names = stringArrayValue(input.names, "names");
    const clientRecordIds = stringArrayValue(input.clientRecordIds, "clientRecordIds");

    if (!names.length && !clientRecordIds.length) {
      throw new HttpError(400, "names or clientRecordIds are required");
    }

    const dataType = input.dataType ? requireDataType(input.dataType) : undefined;
    const records: LedgerRow[] = [];

    for (const name of names) {
      const [record] = dataType
        ? this.sql<LedgerRow>`
            SELECT * FROM owned_google_records
            WHERE data_type = ${dataType} AND google_name = ${name} AND status = 'active'
            LIMIT 1
          `
        : this.sql<LedgerRow>`
            SELECT * FROM owned_google_records
            WHERE google_name = ${name} AND status = 'active'
            LIMIT 1
          `;
      if (record) {
        records.push(record);
      }
    }

    for (const clientRecordId of clientRecordIds) {
      if (!dataType) {
        throw new HttpError(400, "dataType is required when deleting by clientRecordIds");
      }
      const [record] = this.sql<LedgerRow>`
        SELECT * FROM owned_google_records
        WHERE data_type = ${dataType} AND client_record_id = ${clientRecordId} AND status = 'active'
        LIMIT 1
      `;
      if (record) {
        records.push(record);
      }
    }

    return [...new Map(records.map((record) => [record.id, record])).values()];
  }
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true }, request, env);
      }

      if (request.method === "GET" && url.pathname === "/oauth/start") {
        await requireBearerAuth(request, env);
        return startOAuth(request, env);
      }

      if (request.method === "GET" && url.pathname === "/oauth/callback") {
        return handleOAuthCallback(request, env);
      }

      const routed = await routeAgentRequest(request, env);
      if (routed) {
        return withCors(routed, request, env);
      }

      throw new HttpError(404, "Not found");
    } catch (error) {
      return errorResponse(error, request, env);
    }
  }
};

async function startOAuth(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const returnTo = url.searchParams.get("returnTo")?.trim();

  if (!userId) {
    throw new HttpError(400, "userId is required");
  }
  if (returnTo && !isAllowedReturnTo(returnTo, env.ALLOWED_ORIGINS)) {
    throw new HttpError(400, "returnTo is not in ALLOWED_ORIGINS");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new HttpError(500, "GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be configured");
  }

  const state = await signJson(
    {
      createdAt: Date.now(),
      nonce: crypto.randomUUID(),
      returnTo,
      userId
    },
    oauthStateSecret(env)
  );
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("access_type", "offline");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("include_granted_scopes", "true");
  google.searchParams.set("prompt", "consent");
  google.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", AGENT_GOOGLE_HEALTH_SCOPES.join(" "));
  google.searchParams.set("state", state);

  return Response.redirect(google.toString(), 302);
}

async function handleOAuthCallback(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const stateToken = url.searchParams.get("state");

  if (!stateToken) {
    throw new HttpError(400, "state is required");
  }

  const state = await verifySignedJson<OAuthState>(stateToken, oauthStateSecret(env), MAX_OAUTH_STATE_AGE_MS);
  if (error) {
    return oauthCompletionResponse(request, env, state, { error });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new HttpError(400, "code is required");
  }

  const token = await exchangeGoogleCode(env, code);
  const agent = await getAgentByName(env.FittyHealthAgent, state.userId);
  const connectUrl = new URL(`/agents/fitty-health-agent/${encodeURIComponent(state.userId)}/internal/connect-google`, url);
  const connectResponse = await agent.fetch(
    new Request(connectUrl, {
      body: JSON.stringify(token),
      headers: {
        "Content-Type": "application/json",
        "X-Fitty-Internal-Token": env.HEALTH_AGENT_API_TOKEN
      },
      method: "POST"
    })
  );

  if (!connectResponse.ok) {
    throw new HttpError(502, "Failed to connect Google Health token to agent", await connectResponse.text());
  }

  return oauthCompletionResponse(request, env, state, { connected: "1" });
}

function oauthCompletionResponse(
  request: Request,
  env: AppEnv,
  state: OAuthState,
  params: Record<string, string>
): Response {
  if (state.returnTo && isAllowedReturnTo(state.returnTo, env.ALLOWED_ORIGINS)) {
    const returnTo = new URL(state.returnTo);
    for (const [key, value] of Object.entries(params)) {
      returnTo.searchParams.set(key, value);
    }
    return Response.redirect(returnTo.toString(), 302);
  }

  return jsonResponse(params, request, env);
}

function oauthStateSecret(env: AppEnv): string {
  return env.OAUTH_STATE_SECRET || env.HEALTH_AGENT_API_TOKEN;
}

function agentSubpath(pathname: string): string {
  const match = pathname.match(/^\/agents\/fitty-health-agent\/[^/]+(\/.*)?$/);
  return match?.[1] ?? pathname;
}

function requireDataType(value: string | undefined): string {
  if (!value || !/^[a-z0-9-]+$/.test(value)) {
    throw new HttpError(400, "dataType must be a Google Health kebab-case data type");
  }
  return value;
}

function requireDataPoint(value: GoogleHealthDataPoint | undefined): GoogleHealthDataPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "dataPoint is required");
  }
  return value;
}

async function normalizeClientRecordId(value: string | undefined): Promise<string> {
  if (value && /^[a-z0-9-]{4,63}$/.test(value)) {
    return value;
  }

  if (value) {
    return `fitty-${await stableHash(value)}`.slice(0, 63);
  }

  return `fitty-${crypto.randomUUID()}`;
}

function clampDays(value: number | undefined, defaultValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(Math.round(value), 1), 90);
}

function publicLedgerRecord(record: LedgerRow): Record<string, unknown> {
  return {
    clientRecordId: record.client_record_id,
    createdAt: record.created_at,
    dataType: record.data_type,
    googleName: record.google_name,
    id: record.id,
    status: record.status,
    updatedAt: record.updated_at
  };
}

function extractAiText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>;
    if (typeof record.response === "string") {
      return record.response;
    }
    if (typeof record.text === "string") {
      return record.text;
    }
    const choices = record.choices;
    if (Array.isArray(choices)) {
      const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
      if (typeof first?.message?.content === "string") {
        return first.message.content;
      }
      if (typeof first?.text === "string") {
        return first.text;
      }
    }
  }

  return JSON.stringify(result);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArrayValue(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new HttpError(400, `${fieldName} must be an array of non-empty strings`);
  }
  return value;
}
