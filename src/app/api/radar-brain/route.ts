import { NextRequest, NextResponse } from "next/server";
import { PERMANENT_ROLES } from "@/lib/agents/roles";
import { DEFAULT_LIMITS, AgentGovernor } from "@/lib/agents/governor";
import { runInvestigation, CYCLE_STEPS, FLOW, DEBATE_ROUNDS } from "@/lib/agents/orchestrator";
import { memoryStatus, recordProviderReliability } from "@/lib/agents/memory";
import { providerStatuses, connectedSearchProviders } from "@/lib/providers/registry";
import { AggregatedSearchService } from "@/lib/providers/aggregated";
import { allSyncStates, recordSyncSuccess, recordSyncError } from "@/lib/providers/syncState";
import { aiHealthCheck, AI_MODEL, aiConfigured } from "@/lib/ai/client";
import { SAFETY } from "@/lib/safety";
import { getMode } from "@/lib/mode";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET — state of the research room: agents, limits, caps, AI status, memory status. */
export async function GET() {
  const [providers, ai, memory] = await Promise.all([providerStatuses(), aiHealthCheck(), memoryStatus()]);
  const lastLiveScan = allSyncStates().map((s) => s.lastSuccessfulSyncAt).filter(Boolean).sort().pop() || null;

  return NextResponse.json({
    safety: SAFETY,
    mode: getMode(),
    permanentAgents: PERMANENT_ROLES,
    limits: DEFAULT_LIMITS,
    flow: FLOW,
    cycleSteps: CYCLE_STEPS,
    debateRounds: DEBATE_ROUNDS,
    ai: { state: ai.state, message: ai.message, model: ai.model },
    memory,
    activeInvestigations: [],       // populated only by a real run — never fabricated
    temporaryAgents: [],
    providerStatus: providers.map((p) => ({ key: p.key, label: p.label, category: p.category, connected: p.connected, state: p.state, message: p.message })),
    lastLiveScan,
    confidencePolicy: "מספר הסוכנים אינו מעלה ביטחון. ביטחון נגזר מראיות עצמאיות, איכות מקור, אמינות ספק, סתירות, אימות ודיוק היסטורי.",
  });
}

/**
 * POST — run one real investigation.
 * body: { question: string, topics?: string[], freshnessHours?: number, roleIds?: string[], persist?: boolean }
 *
 * Evidence comes from providers that pass a real health check. If the AI layer cannot be
 * reached the response says NOT_AVAILABLE with the reason; it never returns invented analysis.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  const freshnessHours = Number(body.freshnessHours || 72);
  const maxResults = Math.min(10, Number(body.maxResults || 6));

  // ---- SCAN: only providers that really answered a health check ----
  const providers = await connectedSearchProviders();
  const providersUsed = providers.map((p) => p.key);
  let observations: any[] = [];
  const scanErrors: string[] = [];

  if (providers.length) {
    const search = new AggregatedSearchService(providers);
    try {
      const results = await search.search(question, { freshnessHours, maxResults });
      observations = results.map((r) => ({
        title: r.title, url: r.url, domain: r.domain, snippet: r.snippet,
        publishedAt: r.publishedAt, provider: r.provider,
      }));
      // Record per-provider outcome so provider reliability is measured, not assumed.
      for (const key of providersUsed) {
        const got = results.some((r) => r.provider === key);
        if (got) recordSyncSuccess(key, results.filter((r) => r.provider === key).length);
        await recordProviderReliability(key, got);
      }
    } catch (e: any) {
      scanErrors.push(String(e?.message || e));
      for (const key of providersUsed) { recordSyncError(key, String(e?.message || e)); await recordProviderReliability(key, false); }
    }
  }

  if (!aiConfigured()) {
    return NextResponse.json({
      state: "NOT_AVAILABLE",
      question, providersUsed, observationCount: observations.length, scanErrors,
      reason: "AI_API_KEY לא מוגדר — לא בוצע ניתוח סוכנים. לא הופק ניתוח מדומה.",
      model: AI_MODEL, safety: SAFETY,
    }, { status: 200 });
  }

  const governor = new AgentGovernor(DEFAULT_LIMITS);
  const result = await runInvestigation(
    { question, observations, roleIds: Array.isArray(body.roleIds) ? body.roleIds : undefined },
    undefined,
    { governor, persist: body.persist !== false },
  );

  return NextResponse.json({
    state: result.aiAvailable ? "LIVE" : "NOT_AVAILABLE",
    providersUsed, observationCount: observations.length, scanErrors,
    safety: SAFETY,
    ...result,
  });
}
