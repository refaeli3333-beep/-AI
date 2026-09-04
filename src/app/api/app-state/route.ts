import { NextResponse } from "next/server";
import { providerStatuses } from "@/lib/providers/registry";
import { allSyncStates } from "@/lib/providers/syncState";
import { aiHealthCheck } from "@/lib/ai/client";
import { memoryStatus } from "@/lib/agents/memory";
import { getMode } from "@/lib/mode";
import { SAFETY } from "@/lib/safety";

export const dynamic = "force-dynamic";

/**
 * The single status source for the home screen.
 *
 * `state` is derived from REAL probes, never from configuration:
 *   LIVE          — every configured provider answered
 *   HYBRID        — some answered, some did not
 *   MOCK          — APP_MODE=DEMO, so generated data is in use (and labelled)
 *   NOT_AVAILABLE — nothing answered
 */
export async function GET() {
  const [providers, ai, memory] = await Promise.all([providerStatuses(), aiHealthCheck(), memoryStatus()]);

  const total = providers.length;
  const connected = providers.filter((p) => p.connected).length;
  const mode = getMode();

  const state: "LIVE" | "HYBRID" | "MOCK" | "NOT_AVAILABLE" =
    mode === "DEMO" ? "MOCK"
    : connected === 0 ? "NOT_AVAILABLE"
    : connected === total ? "LIVE"
    : "HYBRID";

  const flags: string[] = [];
  // A key that exists but is rejected is a flag, not a green light.
  for (const p of providers) {
    if (!p.connected && p.requiresKey && !p.missingEnvKeys.length) flags.push(`${p.label}: מפתח קיים אך החיבור נכשל`);
  }
  if (ai.state !== "LIVE") flags.push(`AI: ${ai.message}`);
  if (!memory.schemaReady) flags.push(`זיכרון: ${memory.message}`);
  // TRANSLATION_API_KEY is explicitly optional and must never block the app.
  if (!process.env.TRANSLATION_API_KEY) flags.push("TRANSLATION_API_KEY חסר (אופציונלי — אינו חוסם)");

  const lastSyncAt = allSyncStates().map((s) => s.lastSuccessfulSyncAt).filter(Boolean).sort().pop() || null;

  return NextResponse.json({
    state, mode, connected, total, lastSyncAt, flags,
    safety: SAFETY,
    ai: { state: ai.state, message: ai.message, model: ai.model },
    memory,
    providers: providers.map((p) => ({
      key: p.key, label: p.label, category: p.category,
      // Per-provider verdict in the same vocabulary the UI shows.
      state: p.connected ? "LIVE" : (p.requiresKey && p.missingEnvKeys.length ? "NOT_AVAILABLE" : "OFFLINE"),
      connected: p.connected, message: p.message, missingEnvKeys: p.missingEnvKeys,
      requests: p.requests ?? 0, errors: p.errors ?? 0, rateLimited: !!p.rateLimited,
      lastSuccessfulSyncAt: p.lastSuccessfulSyncAt ?? null,
    })),
  });
}
