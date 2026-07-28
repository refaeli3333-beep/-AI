import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

// Returns a service-role client for server-side jobs, or null if not configured.
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // app must still work without Supabase configured
  if (!_client) _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
