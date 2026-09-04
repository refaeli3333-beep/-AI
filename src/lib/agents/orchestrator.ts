import { PERMANENT_ROLES, roleById } from "./roles";
import { AgentGovernor, DEFAULT_LIMITS } from "./governor";
import { runConsensus, AgentConclusion, ConsensusResult } from "./consensus";
import { computeConfidence, countIndependentSources, ConfidenceBreakdown } from "./confidence";
import { analyzeWithRole, analyzeTemporary, Observation } from "./aiAgent";
import { scoreSource } from "../search/sourceScore";
import { historicalAccuracy, providerReliabilityScore, saveInvestigation, MemoryWriteReport } from "./memory";
import { assertSimulationOnly } from "../safety";

/** The continuous-radar cycle, in fixed order. */
export const CYCLE_STEPS = [
  "SCAN", "NORMALIZE_DATA", "STORE_OBSERVATIONS", "COMPARE_TO_HISTORY", "DETECT_CHANGES",
  "CREATE_HYPOTHESES", "ASSIGN_SPECIALIST_AGENTS", "CHALLENGE_EACH_HYPOTHESIS", "VERIFY_SOURCES",
  "BUILD_CONSENSUS", "SAVE_CONCLUSION", "SAVE_WHAT_WAS_LEARNED",
] as const;
export type CycleStep = typeof CYCLE_STEPS[number];

/** The investigation flow the room actually walks. */
export const FLOW = [
  "SCAN", "DETECT", "VERIFY", "INVESTIGATE", "CHALLENGE", "DEBATE", "CONSENSUS", "SAVE_WHAT_WAS_LEARNED",
] as const;
export type FlowStage = typeof FLOW[number];

/** The 4 debate rounds. */
export const DEBATE_ROUNDS = ["INDEPENDENT", "INSPECT_CONTRADICTIONS", "VERIFY_CHALLENGE", "FINAL_SYNTHESIS"] as const;

export interface InvestigationInput {
  question: string;
  observations: Observation[];
  /** Optional subset of permanent roles (ids). Defaults to all 22. */
  roleIds?: string[];
}

export interface SpawnRecord {
  question: string; job: string;
  granted: boolean; reason?: string;      // refusals are recorded, not silently dropped
  agentId?: string;
}

export interface InvestigationResult {
  investigationId: string;
  question: string;
  steps: CycleStep[];
  flow: FlowStage[];
  rounds: string[];
  consensus: ConsensusResult;
  confidence: ConfidenceBreakdown;
  conclusions: AgentConclusion[];
  agentsInvolved: string[];
  temporaryAgents: SpawnRecord[];
  tempAgentsSpawned: number;
  contradictions: { claimA: string; claimB: string; note: string }[];
  bullArguments: string[];
  bearArguments: string[];
  unresolvedQuestions: string[];
  aiAvailable: boolean;
  aiUnavailableReason?: string;
  memory?: MemoryWriteReport;
  timestamp: string;
}

export type AnalyzeHook = (agentId: string, question: string, observations: Observation[], round: string,
  peers?: { agentId: string; stance: any; argument: string }[]) => Promise<AgentConclusion>;

/** Default hook: the REAL AI layer. Injectable so tests can run without network. */
const defaultAnalyze: AnalyzeHook = async (agentId, question, observations, round, peers) => {
  const role = roleById(agentId)!;
  return analyzeWithRole(role, question, observations, { round, peerClaims: peers, effort: round === "INDEPENDENT" ? "low" : "medium" });
};

/** Bounded-concurrency map so the governor's concurrency limit is actually respected. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`);

/**
 * One full investigation:
 *   SCAN → DETECT → VERIFY → INVESTIGATE → CHALLENGE → DEBATE → CONSENSUS → SAVE WHAT WAS LEARNED
 *
 * Specialists first reason independently, then see each other's claims and may revise or
 * hold. Where the permanent room cannot answer an important question from evidence, the
 * orchestrator asks the governor for a LIMITED temporary specialist — and records every
 * refusal, so the caps are visible rather than silent.
 *
 * Agreement never becomes confidence: `runConsensus` reports the vote, `computeConfidence`
 * scores the evidence, and the two are kept apart on purpose.
 */
export async function runInvestigation(
  input: InvestigationInput,
  analyze: AnalyzeHook = defaultAnalyze,
  opts: { governor?: AgentGovernor; persist?: boolean } = {},
): Promise<InvestigationResult> {
  assertSimulationOnly();                                   // no trading, ever
  const governor = opts.governor ?? new AgentGovernor(DEFAULT_LIMITS);
  const limits = governor.caps;
  const investigationId = uuid();
  const roles = input.roleIds?.length
    ? PERMANENT_ROLES.filter((r) => input.roleIds!.includes(r.id))
    : PERMANENT_ROLES;

  // ---- SCAN / DETECT / VERIFY: the evidence is what the providers actually returned ----
  const observations = input.observations;

  // ---- INVESTIGATE — ROUND 1: independent conclusions, no cross-talk ----
  const round1 = await mapLimited(roles, limits.maxConcurrentAgents,
    (role) => analyze(role.id, input.question, observations, "INDEPENDENT"));

  const live = round1.filter((c) => c.available !== false);
  const aiAvailable = live.length > 0;
  const aiUnavailableReason = aiAvailable ? undefined : (round1[0]?.unavailableReason || "AI לא זמין");

  // ---- CHALLENGE — ROUND 2: only agents whose stance differs from the room revise ----
  const tally = { agree: 0, disagree: 0, uncertain: 0 } as Record<string, number>;
  for (const c of live) tally[c.stance]++;
  const majority = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || "uncertain");
  const peerClaims = live.map((c) => ({ agentId: c.agentId, stance: c.stance, argument: c.argument }));

  const challengers = live.filter((c) => c.stance !== majority || ["contrarian", "bear", "bull", "evidence", "source"].includes(c.agentId));
  const round2 = aiAvailable
    ? await mapLimited(challengers, limits.maxConcurrentAgents,
        (c) => analyze(c.agentId, input.question, observations, "INSPECT_CONTRADICTIONS", peerClaims))
    : [];

  // A revised conclusion replaces the agent's round-1 view.
  const byAgent = new Map<string, AgentConclusion>(round1.map((c) => [c.agentId, c]));
  for (const r of round2) if (r.available !== false) byAgent.set(r.agentId, r);

  // ---- DEBATE — ROUND 3: temporary specialists for gaps the room could not close ----
  const openQuestions = Array.from(new Set(
    Array.from(byAgent.values())
      .filter((c) => c.available !== false && c.openQuestion && String(c.openQuestion).trim())
      .map((c) => String(c.openQuestion).trim())));

  const temporaryAgents: SpawnRecord[] = [];
  const tempConclusions: AgentConclusion[] = [];
  if (aiAvailable) {
    for (const q of openQuestions) {
      const job = `לענות על פער מחקר יחיד: ${q}`;
      const req = { question: q, job, depth: 1 };
      const spawn = governor.spawn(req);
      if (!spawn.ok || !spawn.agent) { temporaryAgents.push({ question: q, job, granted: false, reason: spawn.reason }); continue; }
      const conclusion = await analyzeTemporary(spawn.agent.id, q, job, observations);
      // Every temporary agent reports evidence + confidence, then is destroyed.
      governor.complete(spawn.agent.id, { evidence: conclusion.citedUrls || [], confidence: conclusion.confidence, tokens: 1500 });
      temporaryAgents.push({ question: q, job, granted: true, agentId: spawn.agent.id });
      tempConclusions.push(conclusion);
    }
  }
  governor.reapExpired();

  const conclusions = [...Array.from(byAgent.values()), ...tempConclusions];

  // ---- CONSENSUS — ROUND 4: the vote is reported; it does NOT set confidence ----
  const consensus = runConsensus(conclusions);

  const citedUrls = conclusions.flatMap((c) => c.citedUrls || []);
  const evidenceUrls = citedUrls.length ? citedUrls : observations.map((o) => o.url || "").filter(Boolean);
  const domains = Array.from(new Set(observations.map((o) => o.domain).filter(Boolean))) as string[];
  const sourceQuality = domains.length
    ? domains.reduce((a, d) => a + scoreSource(d).score, 0) / domains.length
    : 0;
  const providerKeys = Array.from(new Set(observations.map((o) => o.provider).filter(Boolean))) as string[];

  const contradictionList = conclusions
    .filter((c) => c.available !== false && (c.contradicts || []).length)
    .flatMap((c) => (c.contradicts || []).map((claim) => ({
      claimA: claim, claimB: `עמדת הרוב: ${majority}`, note: `${c.agentId} מצא סתירה בראיות`,
    })));

  const confidence = computeConfidence({
    independentSources: countIndependentSources(evidenceUrls),
    sourceQuality,
    providerReliability: await providerReliabilityScore(providerKeys),
    // Verified = the agent actually cited a source URL rather than reasoning from the title alone.
    verifiedShare: conclusions.length ? conclusions.filter((c) => (c.citedUrls || []).length > 0).length / conclusions.length : 0,
    contradictions: contradictionList.length,
    unresolvedQuestions: temporaryAgents.filter((t) => !t.granted).length +
      tempConclusions.filter((c) => c.stance === "uncertain").length,
    historicalAccuracy: await historicalAccuracy(),
  });

  const bullArguments = conclusions.filter((c) => c.available !== false && (c.agentId === "bull" || c.stance === "agree")).map((c) => c.argument).filter(Boolean);
  const bearArguments = conclusions.filter((c) => c.available !== false && (c.agentId === "bear" || c.stance === "disagree")).map((c) => c.argument).filter(Boolean);
  const unresolvedQuestions = [
    ...openQuestions.filter((q) => !temporaryAgents.find((t) => t.question === q && t.granted)),
    ...tempConclusions.filter((c) => c.stance === "uncertain").map((c) => c.argument),
  ];

  const result: InvestigationResult = {
    investigationId,
    question: input.question,
    steps: [...CYCLE_STEPS],
    flow: [...FLOW],
    rounds: [...DEBATE_ROUNDS],
    consensus, confidence, conclusions,
    agentsInvolved: roles.map((r) => r.id),
    temporaryAgents,
    tempAgentsSpawned: governor.totalSpawned,
    contradictions: contradictionList,
    bullArguments, bearArguments, unresolvedQuestions,
    aiAvailable, aiUnavailableReason,
    timestamp: new Date().toISOString(),
  };

  // ---- SAVE WHAT WAS LEARNED ----
  if (opts.persist !== false) {
    result.memory = await saveInvestigation({
      investigationId, question: input.question, observations,
      conclusions, consensus, confidence,
      contradictions: contradictionList,
      bullArguments, bearArguments, unresolvedQuestions,
      invalidationTriggers: contradictionList.map((c) => c.claimA),
      reasoningSummary: aiAvailable
        ? `רוב: ${consensus.majorityStance} · הסכמה ${consensus.consensusScore} · ביטחון מבוסס-ראיות ${confidence.score}`
        : `לא בוצעה חקירה — AI אינו זמין: ${aiUnavailableReason}`,
    });
  }

  return result;
}
