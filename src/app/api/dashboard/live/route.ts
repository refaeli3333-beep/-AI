import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db";
import { providerStatuses } from "@/lib/providers/registry";
import { allSyncStates } from "@/lib/providers/syncState";
import { getMode } from "@/lib/mode";

export const dynamic = "force-dynamic";

/**
 * Feeds the advanced live-radar widgets.
 *
 * Everything here comes from the database. When Supabase is not configured — or the
 * tables have not been created — the widgets get empty arrays and `configured: false`,
 * so the UI says "not connected yet" instead of showing invented signals.
 */
export async function GET() {
  const db = getServiceClient();
  const providers = await providerStatuses();
  const connected = providers.filter((p) => p.connected).length;
  const lastSyncAt = allSyncStates().map((s) => s.lastSuccessfulSyncAt).filter(Boolean).sort().pop() || null;
  const mode = getMode();

  const appState = {
    state: mode === "DEMO" ? "MOCK" : connected === 0 ? "OFFLINE" : connected === providers.length ? "LIVE" : "PARTIAL",
    flags: providers.filter((p) => !p.connected).map((p) => p.label),
  };

  const providerHealth = providers.map((p) => ({
    key: p.key, label: p.label, connected: p.connected,
    requests: p.requests ?? 0, errors: p.errors ?? 0, rateLimited: !!p.rateLimited,
  }));

  const base = {
    appState, connectedProviders: connected, totalProviders: providers.length,
    lastSyncAt, providerHealth,
  };

  if (!db) {
    return NextResponse.json({
      ...base, configured: false,
      liveRadar: [], breaking: [], beneficiaries: [], negatives: [], latestSignals: [], monitoredPeople: [],
      note: "Supabase לא מוגדר — אין נתוני רדאר לשמור או להציג. לא מוצגים נתונים מדומים.",
    });
  }

  // A missing table must not 500 the dashboard — it means "no data yet".
  const safe = async <T>(run: () => any, fallback: T): Promise<T> => {
    try { const { data, error } = await run(); return error ? fallback : ((data ?? fallback) as T); }
    catch { return fallback; }
  };

  const [liveRadar, breaking, signals, people] = await Promise.all([
    safe<any[]>(() => db.from("memory_events").select("id,title_he,created_at").order("created_at", { ascending: false }).limit(6), []),
    safe<any[]>(() => db.from("conclusions").select("id,question,confidence,created_at").order("confidence", { ascending: false }).limit(6), []),
    safe<any[]>(() => db.from("signal_assets").select("id,ticker,direction,opportunity_score,risk_score,confidence_score").order("opportunity_score", { ascending: false }).limit(20), []),
    safe<any[]>(() => db.from("influential_people").select("full_name").eq("is_active", true).limit(10), []),
  ]);

  return NextResponse.json({
    ...base, configured: true,
    liveRadar,
    breaking: breaking.map((c: any) => ({ id: c.id, title_he: c.question, confidence_score: c.confidence })),
    beneficiaries: signals.filter((s: any) => (s.opportunity_score ?? 0) > (s.risk_score ?? 0)).slice(0, 6),
    negatives: signals.filter((s: any) => (s.risk_score ?? 0) >= (s.opportunity_score ?? 0)).slice(0, 6),
    latestSignals: signals.slice(0, 6),
    monitoredPeople: people.map((p: any) => p.full_name),
  });
}
