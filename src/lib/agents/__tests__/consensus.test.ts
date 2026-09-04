import { describe, it, expect } from "vitest";
import { runConsensus, AgentConclusion } from "../consensus";

const c = (agentId: string, stance: AgentConclusion["stance"], extra: Partial<AgentConclusion> = {}): AgentConclusion =>
  ({ agentId, stance, confidence: 70, evidenceQuality: 60, argument: `${agentId} argument`, ...extra });

describe("runConsensus", () => {
  it("never hides dissent", () => {
    const r = runConsensus([c("a", "agree"), c("b", "agree"), c("d1", "disagree"), c("d2", "disagree")]);
    expect(r.dissent).toHaveLength(2);
    expect(r.dissent.map((x) => x.agentId)).toEqual(["d1", "d2"]);
    expect(r.dissent[0].argument).toContain("argument");
  });

  it("excludes agents that could not run instead of counting them as uncertain", () => {
    const conclusions = [
      c("a", "agree"), c("b", "agree"),
      c("off1", "uncertain", { available: false, unavailableReason: "AI offline" }),
      c("off2", "uncertain", { available: false, unavailableReason: "AI offline" }),
    ];
    const r = runConsensus(conclusions);
    expect(r.agreement).toEqual({ agree: 2, disagree: 0, uncertain: 0 });
    expect(r.unavailable).toHaveLength(2);
    expect(r.unavailable[0].reason).toBe("AI offline");
    // An outage must not shift the vote: two agreeing agents are still unanimous.
    expect(r.consensusScore).toBe(100);
  });

  it("penalises consensus when a bloc disagrees", () => {
    const unanimous = runConsensus([c("a", "agree"), c("b", "agree"), c("c", "agree")]);
    const split = runConsensus([c("a", "agree"), c("b", "agree"), c("d", "disagree")]);
    expect(split.consensusScore).toBeLessThan(unanimous.consensusScore);
  });

  it("keeps every score within 0..100", () => {
    const r = runConsensus([c("a", "agree"), c("d", "disagree"), c("u", "uncertain")]);
    for (const v of [r.consensusScore, r.confidence, r.evidenceQuality]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("reports the majority stance", () => {
    expect(runConsensus([c("a", "disagree"), c("b", "disagree"), c("c", "agree")]).majorityStance).toBe("disagree");
  });
});
