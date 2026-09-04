import { getServiceClient } from "../db";

/**
 * Per-provider connection/sync state. Kept in-process (survives across requests on the
 * same server instance) and mirrored to Supabase `provider_connections` when configured.
 * Nothing here is invented: values are only written after a real check or a real sync.
 */
export interface SyncState {
  providerKey: string;
  lastCheckedAt: string | null;
  lastSuccessfulSyncAt: string | null;   // only set after a sync that actually returned data
  lastError: string | null;
  lastErrorAt: string | null;
  recordsCollected: number;              // cumulative across syncs
  errorsCount: number;
  lastRunResultCount: number | null;
}

const STATE = new Map<string, SyncState>();

function blank(providerKey: string): SyncState {
  return { providerKey, lastCheckedAt: null, lastSuccessfulSyncAt: null, lastError: null,
    lastErrorAt: null, recordsCollected: 0, errorsCount: 0, lastRunResultCount: null };
}

export function getSyncState(providerKey: string): SyncState {
  if (!STATE.has(providerKey)) STATE.set(providerKey, blank(providerKey));
  return STATE.get(providerKey)!;
}
export function allSyncStates(): SyncState[] { return Array.from(STATE.values()); }

export function recordCheck(providerKey: string, connected: boolean, message: string) {
  const s = getSyncState(providerKey);
  s.lastCheckedAt = new Date().toISOString();
  if (!connected) { s.lastError = message; s.lastErrorAt = s.lastCheckedAt; }
  return s;
}

export function recordSyncSuccess(providerKey: string, resultCount: number) {
  const s = getSyncState(providerKey);
  const now = new Date().toISOString();
  s.lastCheckedAt = now;
  s.lastSuccessfulSyncAt = now;          // real sync only
  s.lastRunResultCount = resultCount;
  s.recordsCollected += resultCount;
  return s;
}

export function recordSyncError(providerKey: string, error: string) {
  const s = getSyncState(providerKey);
  const now = new Date().toISOString();
  s.lastCheckedAt = now; s.lastError = error; s.lastErrorAt = now; s.errorsCount++;
  s.lastRunResultCount = 0;
  return s;
}

/** Best-effort mirror to Supabase; silently skipped when the DB isn't configured. */
export async function persistState(providerKey: string, connected: boolean, missingEnvKeys: string[]) {
  const db = getServiceClient();
  if (!db) return;
  const s = getSyncState(providerKey);
  try {
    await db.from("provider_connections").upsert({
      provider_key: providerKey, is_connected: connected, missing_env_keys: missingEnvKeys,
      last_checked_at: s.lastCheckedAt, records_collected: s.recordsCollected, errors_count: s.errorsCount,
    }, { onConflict: "provider_key" });
  } catch { /* DB mirror is optional — never break a scan because of it */ }
}
