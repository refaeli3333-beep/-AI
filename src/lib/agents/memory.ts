import { getServiceClient } from "../db";
import { AgentConclusion, ConsensusResult } from "./consensus";
import { ConfidenceBreakdown } from "./confidence";

/**
 * Long-term memory for the research room (migration 0005_agent_memory.sql).
 *
 * Every write is additive — inserts and upserts only, never a delete or a schema change.
 * When Supabase is not configured, or the tables have not been created yet, saving is a
 * no-op that reports `persisted: false` with the reason; the investigation still returns
 * its result, and the UI shows that learning was not stored rather than implying it was.
 */

export interface SaveInvestigationInput {
  investigationId: string;
  question: string;
  observations: { title?: string; url?: string; domain?: string; provider?: string; publishedAt?: string | null }[];
  conclusions: AgentConclusion[];
  consensus: ConsensusResult;
  confidence: ConfidenceBreakdown;
  contradictions: { claimA: string; claimB: string; note: string }[];
  bullArguments: string[];
  bearArguments: string[];
  unresolvedQuestions: string[];
  invalidationTriggers: string[];
  reasoningSummary: string;
}

export interface MemoryWriteReport {
  persisted: boolean;
  reason?: string;
  tablesWritten: string[];
  tablesFailed: { table: string; error: string }[];
}

/** Whether the memory schema is actually reachable — probed, not assumed. */
export async function memoryStatus(): Promise<{ configured: boolean; schemaReady: boolean; message: string }> {
  const db = getServiceClient();
  if (!db) return { configured: false, schemaReady: false, message: "Supabase לא מוגדר (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" };
  const { error } = await db.from("conclusions").select("id").limit(1);
  if (!error) return { configured: true, schemaReady: true, message: "זיכרון פעיל" };
  return {
    configured: true, schemaReady: false,
    message: `Supabase מחובר אך טבלאות הזיכרון חסרות — יש להריץ supabase/migrations/0005_agent_memory.sql (${error.message})`,
  };
}

/**
 * Persist one full investigation. Each table is written independently so a single
 * missing table cannot lose the rest of the learning.
 */
export async function saveInvestigation(input: SaveInvestigationInput): Promise<MemoryWriteReport> {
  const db = getServiceClient();
  if (!db) return { persisted: false, reason: "Supabase לא מוגדר — הלמידה לא נשמרה", tablesWritten: [], tablesFailed: [] };

  const written: string[] = [];
  const failed: { table: string; error: string }[] = [];
  const attempt = async (table: string, run: () => Promise<{ error: any }>) => {
    try {
      const { error } = await run();
      if (error) failed.push({ table, error: error.message || String(error) });
      else written.push(table);
    } catch (e: any) { failed.push({ table, error: e?.message || String(e) }); }
  };

  const id = input.investigationId;

  await attempt("observations", async () => db.from("observations").insert(
    input.observations.slice(0, 50).map((o) => ({
      scan_id: id, entity: o.domain || null, kind: "search_result",
      payload: { title: o.title, provider: o.provider, publishedAt: o.publishedAt },
      source_url: o.url || null,
    }))));

  await attempt("memory_sources", async () => db.from("memory_sources").upsert(
    Array.from(new Map(input.observations
      .filter((o) => o.url && o.domain)
      .map((o) => [o.url!, { url: o.url!, domain: o.domain!, reliability_score: null as number | null }])).values()),
    { onConflict: "url", ignoreDuplicates: true }));

  await attempt("agent_results", async () => db.from("agent_results").insert(
    input.conclusions.map((c) => ({
      investigation_id: id, agent_id: c.agentId, stance: c.stance,
      confidence: c.confidence, evidence_quality: c.evidenceQuality,
      // The unavailability reason is stored too — an outage must stay visible in history.
      argument: c.available === false ? `[UNAVAILABLE] ${c.unavailableReason || ""}` : c.argument,
    }))));

  if (input.contradictions.length) {
    await attempt("contradictions", async () => db.from("contradictions").insert(
      input.contradictions.map((k) => ({ investigation_id: id, claim_a: k.claimA, claim_b: k.claimB, note: k.note }))));
  }

  await attempt("conclusions", async () => db.from("conclusions").insert({
    investigation_id: id, question: input.question,
    reasoning_summary: input.reasoningSummary,
    confidence: input.confidence.score,
    consensus_score: input.consensus.consensusScore,
    evidence_quality: input.consensus.evidenceQuality,
    agents_involved: input.conclusions.map((c) => c.agentId),
    bull_arguments: input.bullArguments,
    bear_arguments: input.bearArguments,
    unresolved_questions: input.unresolvedQuestions,
    future_verification_triggers: input.invalidationTriggers,
    sources: input.observations.slice(0, 50).map((o) => ({ url: o.url, domain: o.domain, provider: o.provider })),
  }));

  await attempt("lessons_learned", async () => db.from("lessons_learned").insert({
    topic: input.question.slice(0, 200),
    lesson: input.confidence.caps.length
      ? `תקרות ביטחון שהופעלו: ${input.confidence.caps.join(" · ")}`
      : "לא הופעלו תקרות ביטחון — הראיות היו מספקות למודל.",
    evidence: { components: input.confidence.components, unresolved: input.unresolvedQuestions },
  }));

  return {
    persisted: written.length > 0,
    reason: failed.length ? `חלק מהטבלאות לא נכתבו: ${failed.map((f) => f.table).join(", ")}` : undefined,
    tablesWritten: written, tablesFailed: failed,
  };
}

/** Rolling provider reliability, used as a real confidence input. Additive upsert. */
export async function recordProviderReliability(providerKey: string, success: boolean): Promise<void> {
  const db = getServiceClient();
  if (!db) return;
  try {
    const { data } = await db.from("provider_reliability").select("*").eq("provider_key", providerKey).maybeSingle();
    const total = (data?.total_checks ?? 0) + 1;
    await db.from("provider_reliability").upsert({
      provider_key: providerKey, total_checks: total,
      successes: (data?.successes ?? 0) + (success ? 1 : 0),
      failures: (data?.failures ?? 0) + (success ? 0 : 1),
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider_key" });
  } catch { /* reliability tracking must never break a scan */ }
}

/** Historical prediction accuracy for the confidence model. null when there is no track record. */
export async function historicalAccuracy(): Promise<number | null> {
  const db = getServiceClient();
  if (!db) return null;
  try {
    const { data, error } = await db.from("prediction_results").select("correct").limit(500);
    if (error || !data?.length) return null;
    const correct = data.filter((r: any) => r.correct === true).length;
    return correct / data.length;
  } catch { return null; }
}

/** Mean observed success rate of the providers behind this evidence. 0.5 when unknown. */
export async function providerReliabilityScore(providerKeys: string[]): Promise<number> {
  const db = getServiceClient();
  if (!db || !providerKeys.length) return 0.5;
  try {
    const { data, error } = await db.from("provider_reliability").select("*").in("provider_key", providerKeys);
    if (error || !data?.length) return 0.5;
    const rates = data
      .filter((r: any) => (r.total_checks ?? 0) > 0)
      .map((r: any) => (r.successes ?? 0) / r.total_checks);
    return rates.length ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : 0.5;
  } catch { return 0.5; }
}
