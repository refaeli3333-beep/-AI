/** Structured consensus from independent agent conclusions. Disagreement is always surfaced. */
export type Stance = "agree" | "disagree" | "uncertain";
export interface AgentConclusion {
  agentId: string; stance: Stance; confidence: number;   // 0..100
  evidenceQuality: number;                                // 0..100
  argument: string;
}
export interface ConsensusResult {
  consensusScore: number;   // 0..100 — weighted agreement
  confidence: number;       // 0..100 — mean confidence of the majority stance
  evidenceQuality: number;  // 0..100 — mean evidence quality
  agreement: { agree: number; disagree: number; uncertain: number };
  majorityStance: Stance;
  dissent: { agentId: string; argument: string }[];      // never hidden
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function runConsensus(conclusions: AgentConclusion[]): ConsensusResult {
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
  };
}
