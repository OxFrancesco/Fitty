import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  isAppleHealthAvailable,
  requestAppleHealthAuthorization,
  writeAppleHealthRecords,
  type AppleHealthSyncRecord,
} from '../../modules/apple-health-sync/src';

import {
  fetchGoogleHealthAppleSyncRecords,
  type GoogleHealthAppleSyncRecord,
} from '@/lib/google-health';

const LEDGER_KEY_PREFIX = 'fitty.apple-health.google-ledger.v1.';
const SYNC_IDENTIFIER_PREFIX = 'fitty.google-health';
const WRITE_BATCH_SIZE = 25;

type LedgerEntry = {
  payloadHash: string;
  syncVersion: number;
  syncedAt: string;
};

type PreparedRecord = {
  source: GoogleHealthAppleSyncRecord;
  target: AppleHealthSyncRecord;
  ledgerKey: string;
  ledgerEntry: LedgerEntry;
};

export type GoogleToAppleHealthSyncSummary = {
  status: 'synced' | 'unsupported';
  rangeLabel: string;
  scanned: number;
  queued: number;
  written: number;
  unchanged: number;
  byType: {
    weight: number;
    sleep: number;
    workout: number;
  };
  message: string;
};

export async function syncGoogleHealthToAppleHealth(
  accessToken: string,
  options: { days?: number } = {}
): Promise<GoogleToAppleHealthSyncSummary> {
  if (Platform.OS !== 'ios') {
    return {
      status: 'unsupported',
      rangeLabel: '',
      scanned: 0,
      queued: 0,
      written: 0,
      unchanged: 0,
      byType: { weight: 0, sleep: 0, workout: 0 },
      message: 'Apple Health sync is only available on iOS.',
    };
  }

  if (!(await isAppleHealthAvailable())) {
    throw new Error('Apple Health is not available on this device.');
  }

  const { records, rangeLabel } = await fetchGoogleHealthAppleSyncRecords(accessToken, options);
  const prepared: PreparedRecord[] = [];
  let unchanged = 0;

  for (const record of records) {
    const next = await prepareRecord(record);

    if (next) {
      prepared.push(next);
    } else {
      unchanged += 1;
    }
  }

  if (!records.length) {
    return {
      status: 'synced',
      rangeLabel,
      scanned: 0,
      queued: 0,
      written: 0,
      unchanged: 0,
      byType: { weight: 0, sleep: 0, workout: 0 },
      message: `No exportable Google Health records found for ${rangeLabel}.`,
    };
  }

  if (!prepared.length) {
    return {
      status: 'synced',
      rangeLabel,
      scanned: records.length,
      queued: 0,
      written: 0,
      unchanged,
      byType: countByType([]),
      message: `Apple Health is already up to date for ${rangeLabel}.`,
    };
  }

  const authorization = await requestAppleHealthAuthorization();
  if (!authorization.available || !authorization.allAuthorized) {
    throw new Error('Apple Health write permission was not granted for weight, sleep, and workouts.');
  }

  let written = 0;

  for (const batch of chunk(prepared, WRITE_BATCH_SIZE)) {
    const result = await writeAppleHealthRecords(batch.map((record) => record.target));
    written += result.saved;

    if (result.saved !== batch.length) {
      throw new Error(`Apple Health saved ${result.saved} of ${batch.length} queued records.`);
    }

    await Promise.all(
      batch.map((record) =>
        SecureStore.setItemAsync(record.ledgerKey, JSON.stringify(record.ledgerEntry))
      )
    );
  }

  const byType = countByType(prepared.map((record) => record.source));

  return {
    status: 'synced',
    rangeLabel,
    scanned: records.length,
    queued: prepared.length,
    written,
    unchanged,
    byType,
    message: formatSyncMessage(written, unchanged, byType, rangeLabel),
  };
}

async function prepareRecord(record: GoogleHealthAppleSyncRecord): Promise<PreparedRecord | null> {
  const sourceKey = `${record.sourceDataType}:${record.sourceId}`;
  const idHash = await sha256(sourceKey);
  const payloadHash = await sha256(stableStringify(record));
  const ledgerKey = `${LEDGER_KEY_PREFIX}${idHash}`;
  const existing = await loadLedgerEntry(ledgerKey);

  if (existing?.payloadHash === payloadHash) {
    return null;
  }

  const syncVersion = (existing?.syncVersion ?? 0) + 1;
  const ledgerEntry: LedgerEntry = {
    payloadHash,
    syncVersion,
    syncedAt: new Date().toISOString(),
  };

  return {
    source: record,
    target: {
      ...record,
      syncIdentifier: `${SYNC_IDENTIFIER_PREFIX}.${idHash}`,
      syncVersion,
      payloadHash,
    },
    ledgerKey,
    ledgerEntry,
  };
}

async function loadLedgerEntry(key: string): Promise<LedgerEntry | null> {
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<LedgerEntry>;
    if (
      typeof parsed.payloadHash === 'string' &&
      typeof parsed.syncVersion === 'number' &&
      typeof parsed.syncedAt === 'string'
    ) {
      return parsed as LedgerEntry;
    }
  } catch {
    return null;
  }

  return null;
}

async function sha256(value: string) {
  return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function countByType(records: GoogleHealthAppleSyncRecord[]) {
  return records.reduce(
    (counts, record) => {
      counts[record.kind] += 1;
      return counts;
    },
    { weight: 0, sleep: 0, workout: 0 }
  );
}

function formatSyncMessage(
  written: number,
  unchanged: number,
  byType: GoogleToAppleHealthSyncSummary['byType'],
  rangeLabel: string
) {
  const parts = [
    byType.weight ? `${byType.weight} weight` : null,
    byType.sleep ? `${byType.sleep} sleep` : null,
    byType.workout ? `${byType.workout} workout` : null,
  ].filter((part): part is string => part !== null);

  const writtenLabel = parts.length ? parts.join(', ') : `${written} records`;
  const skippedLabel = unchanged ? `, skipped ${unchanged} unchanged` : '';
  return `Synced ${writtenLabel} to Apple Health for ${rangeLabel}${skippedLabel}.`;
}
