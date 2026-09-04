/** Structured consensus from independent agent conclusions. Disagreement is always surfaced. */
export type Stance = "agree" | "disagree" | "uncertain";
export interface AgentConclusion {
  agentId: string; stance: Stance; confidence: number;   // 0..100
  evidenceQuality: number;                                // 0..100
  argument: string;
  // --- optional, filled by the real AI layer; consensus math ignores them ---
  /** false when the model could not be reached — the agent then carries no opinion. */
  available?: boolean;
  /** Reason the agent is unavailable (billing, network, refusal). Surfaced, never hidden. */
  unavailableReason?: string;
  /** Source URLs this agent actually relied on. */
  citedUrls?: string[];
  /** A question this agent could not answer from the evidence — may trigger a temporary specialist. */
  openQuestion?: string | null;
  /** Claims this agent believes are contradicted by the evidence. */
  contradicts?: string[];
  /** Which debate round produced this conclusion. */
  round?: string;
  /** true for a temporary specialist spawned by the governor. */
  temporary?: boolean;
}
export interface ConsensusResult {
  consensusScore: number;   // 0..100 — weighted agreement
  confidence: number;       // 0..100 — mean confidence of the majority stance
  evidenceQuality: number;  // 0..100 — mean evidence quality
  agreement: { agree: number; disagree: number; uncertain: number };
  majorityStance: Stance;
  dissent: { agentId: string; argument: string }[];      // never hidden
  /** Agents that could not run (AI offline). They hold no opinion and are excluded from the vote. */
  unavailable: { agentId: string; reason: string }[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function runConsensus(all: AgentConclusion[]): ConsensusResult {
  // An agent that could not run has no opinion: counting it as "uncertain" would let an
  // outage quietly move the consensus. Excluded from the vote, reported explicitly.
  const unavailable = all.filter((c) => c.available === false);
  const conclusions = all.filter((c) => c.available !== false);
  const agree = conclusions.filter((c) => c.stance === "agree");
  const disagree = conclusions.filter((c) => c.stance === "disagree");
  const uncertain = conclusions.filter((c) => c.stance === "uncertain");
  const n = conclusions.length || 1;

  // consensus = share of the strongest bloc, weighted by confidence, penalized by dissent
  const blocs = [agree, disagree, uncertain].sort((a, b) => b.length - a.length);
  const majority = blocs[0];
  const majorityStance: Stance = majority === agree ? "agree" : majority === disagree ? "disagree" : "uncertain";
  const share = majority.length / n;
  const dissentShare = disagree.length / n;
  const consensusScore = Math.round(clamp(share * 100 - dissentShare * 20));

  return {
    consensusScore,
    confidence: Math.round(clamp(mean(majority.map((c) => c.confidence)))),
    evidenceQuality: Math.round(clamp(mean(conclusions.map((c) => c.evidenceQuality)))),
    agreement: { agree: agree.length, disagree: disagree.length, uncertain: uncertain.length },
    majorityStance,
    dissent: disagree.map((c) => ({ agentId: c.agentId, argument: c.argument })),  // surfaced, never hidden
    unavailable: unavailable.map((c) => ({ agentId: c.agentId, reason: c.unavailableReason || "AI לא זמין" })),
  };
}
