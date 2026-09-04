import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * supabase-js expects the PROJECT ROOT url (https://<ref>.supabase.co) and appends
 * /rest/v1 itself. A value that already carries the REST path produces
 * ".../rest/v1/rest/v1/<table>", which PostgREST rejects with PGRST125 — every query
 * fails silently and the app looks like it simply has no data. Normalising here means a
 * copied-from-the-dashboard REST url keeps working.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

/** Service-role client for server-side jobs, or null if not configured. */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // app must still work without Supabase configured
  if (!_client) _client = createClient(normalizeSupabaseUrl(url), key, { auth: { persistSession: false } });
  return _client;
}
