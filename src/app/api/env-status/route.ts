import { NextResponse } from "next/server";
import { getMode } from "@/lib/mode";

export const dynamic = "force-dynamic";

// Reports mode + which API keys are missing (never returns key values).
export async function GET() {
  const keys = ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID", "MARKET_DATA_API_KEY",
    "X_API_BEARER_TOKEN", "TRANSLATION_API_KEY", "AI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = keys.filter((k) => !process.env[k]);
  return NextResponse.json({ mode: getMode(), missingKeys: missing, supabaseConfigured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY });
}
