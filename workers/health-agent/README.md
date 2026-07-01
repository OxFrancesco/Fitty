# OpenFit Health Agent

Cloudflare Worker Agent for interacting with Google Health API data through a per-user Durable Object. It can read, answer questions over, create, patch, and delete Google Health data points.

## Shape

- Runtime: Cloudflare Workers + Agents SDK + SQLite Durable Objects.
- Auth: bearer token for API calls, OAuth 2.0 for Google Health consent.
- Google tokens: refresh tokens are AES-GCM encrypted before being stored in agent state.
- Writes: every created data point gets an app-owned Google data point name and a SQLite ledger row.
- Deletes: only active records in the app-owned ledger can be deleted.

## Setup

```sh
cd workers/health-agent
npm install
npm run types
```

Update `wrangler.jsonc`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_REDIRECT_URI`
- `ALLOWED_ORIGINS`
- `AI_MODEL` if you want a different Workers AI text model

Set secrets:

```sh
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put HEALTH_AGENT_API_TOKEN
npx wrangler secret put TOKEN_ENCRYPTION_KEY
npx wrangler secret put OAUTH_STATE_SECRET
```

Use a random encryption key:

```sh
openssl rand -base64 32
```

For local development, keep equivalent values in an uncommitted `.dev.vars` file.

Deploy:

```sh
npm run deploy
```

## OAuth

Start Google consent for an agent instance:

```sh
curl -H "Authorization: Bearer $HEALTH_AGENT_API_TOKEN" \
  "https://<worker>/oauth/start?userId=francesco&returnTo=fitty://oauth"
```

The worker requests read scopes plus the Google Health write-only scopes needed for app-owned create/patch/delete operations.

## Agent Endpoints

Agent routes use Cloudflare's standard path:

```text
/agents/fitty-health-agent/{userId}/{endpoint}
```

All data endpoints require:

```text
Authorization: Bearer <HEALTH_AGENT_API_TOKEN>
```

Useful endpoints:

- `GET /status`
- `POST /ask` with `{ "question": "How did my sleep trend this month?", "days": 30 }`
- `POST /snapshot` with `{ "days": 30 }`
- `POST /data-points/list`
- `POST /data-points/rollup`
- `POST /data-points/create`
- `PATCH /data-points`
- `DELETE /data-points`
- `POST /weight`
- `POST /steps`
- `POST /sleep`
- `POST /exercise`

Example weight write:

```sh
curl -X POST "https://<worker>/agents/fitty-health-agent/francesco/weight" \
  -H "Authorization: Bearer $HEALTH_AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientRecordId": "morning-weight-2026-06-27",
    "weightKg": 78.2,
    "measuredAt": "2026-06-27T07:30:00+02:00",
    "notes": "manual entry"
  }'
```

Delete by app-owned client record id:

```sh
curl -X DELETE "https://<worker>/agents/fitty-health-agent/francesco/data-points" \
  -H "Authorization: Bearer $HEALTH_AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "weight",
    "clientRecordIds": ["morning-weight-2026-06-27"]
  }'
```

## Notes

The Expo app currently uses read-only Google Health scopes. Use this worker OAuth flow for write access, or expand the app OAuth flow deliberately after Google scope review.

`HEALTH_AGENT_API_TOKEN` is a coarse bearer secret. Do not ship it in the mobile app; replace it with user-scoped auth or call this worker from trusted server code before exposing it to multiple users.

The answer endpoint is not medical advice. It summarizes and compares the Google Health data available to the worker.
