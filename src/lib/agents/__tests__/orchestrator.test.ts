import { describe, it, expect } from "vitest";
import { runInvestigation, FLOW, DEBATE_ROUNDS } from "../orchestrator";
import { AgentGovernor } from "../governor";
import { AgentConclusion } from "../consensus";
import { PERMANENT_ROLES } from "../roles";

const observations = [
  { title: "SEC filing", url: "https://www.sec.gov/a", domain: "sec.gov", snippet: "s", publishedAt: null, provider: "SecEdgarProvider" },
  { title: "Reuters report", url: "https://reuters.com/b", domain: "reuters.com", snippet: "s", publishedAt: null, provider: "RssProvider" },
];

/** Injected hook — lets the flow be tested without touching the network or a model. */
function hook(over: (agentId: string, round: string) => Partial<AgentConclusion> = () => ({})) {
  const calls: { agentId: string; round: string }[] = [];
  const fn = async (agentId: string, _q: string, _o: any[], round: string): Promise<AgentConclusion> => {
    calls.push({ agentId, round });
    return {
      agentId, stance: "agree", confidence: 80, evidenceQuality: 70, argument: `${agentId} says so`,
      available: true, citedUrls: ["https://www.sec.gov/a"], contradicts: [], openQuestion: null, round,
      ...over(agentId, round),
    };
  };
  return { fn, calls };
}

describe("runInvestigation", () => {
  it("walks the full flow and reports the four debate rounds", async () => {
    const { fn } = hook();
    const r = await runInvestigation({ question: "q", observations }, fn, { persist: false });
    expect(r.flow).toEqual([...FLOW]);
    expect(r.rounds).toEqual([...DEBATE_ROUNDS]);
    expect(r.flow[0]).toBe("SCAN");
    expect(r.flow[r.flow.length - 1]).toBe("SAVE_WHAT_WAS_LEARNED");
  });

  it("runs every permanent specialist independently in round 1", async () => {
    const { fn, calls } = hook();
    await runInvestigation({ question: "q", observations }, fn, { persist: false });
    const round1 = calls.filter((c) => c.round === "INDEPENDENT");
    expect(round1).toHaveLength(PERMANENT_ROLES.length);
    expect(new Set(round1.map((c) => c.agentId)).size).toBe(PERMANENT_ROLES.length);
  });

  it("spawns temporary specialists only for real research gaps, and respects the cap", async () => {
    // Every agent raises a DIFFERENT open question — far more than the cap of 8.
    const { fn } = hook((agentId) => ({ openQuestion: `gap for ${agentId}` }));
    const governor = new AgentGovernor({ maxAgentDepth: 3, maxConcurrentAgents: 12, maxTemporaryAgentsPerInvestigation: 8, maxTokenBudget: 200_000 });
    const r = await runInvestigation({ question: "q", observations }, fn, { governor, persist: false });

    const granted = r.temporaryAgents.filter((t) => t.granted);
    const refused = r.temporaryAgents.filter((t) => !t.granted);
    expect(granted.length).toBeLessThanOrEqual(8);
    expect(refused.length).toBeGreaterThan(0);
    // Refusals are recorded with a reason rather than silently dropped.
    expect(refused[0].reason).toBe("max_temporary_agents_reached");
  });

  it("creates no temporary agent when the room has no open questions", async () => {
    const { fn } = hook();
    const r = await runInvestigation({ question: "q", observations }, fn, { persist: false });
    expect(r.temporaryAgents).toHaveLength(0);
    expect(r.tempAgentsSpawned).toBe(0);
  });

  it("does not raise confidence when more agents agree", async () => {
    const { fn } = hook();
    const all = await runInvestigation({ question: "q", observations }, fn, { persist: false });
    const few = await runInvestigation({ question: "q", observations, roleIds: ["news", "market", "risk"] }, fn, { persist: false });
    // Same evidence, very different agent counts — confidence must be identical.
    expect(few.confidence.score).toBe(all.confidence.score);
    expect(all.consensus.agreement.agree).toBeGreaterThan(few.consensus.agreement.agree);
  });

  it("surfaces dissent instead of smoothing it away", async () => {
    const { fn } = hook((agentId) => (agentId === "contrarian" ? { stance: "disagree", argument: "evidence is thin" } : {}));
    const r = await runInvestigation({ question: "q", observations }, fn, { persist: false });
    expect(r.consensus.dissent.some((d) => d.agentId === "contrarian")).toBe(true);
  });

  it("reports NOT_AVAILABLE rather than inventing analysis when the AI layer is down", async () => {
    const fn = async (agentId: string): Promise<AgentConclusion> => ({
      agentId, stance: "uncertain", confidence: 0, evidenceQuality: 0,
      argument: "", available: false, unavailableReason: "billing", citedUrls: [], contradicts: [], openQuestion: null,
    });
    const r = await runInvestigation({ question: "q", observations }, fn, { persist: false });
    expect(r.aiAvailable).toBe(false);
    expect(r.aiUnavailableReason).toBe("billing");
    expect(r.consensus.unavailable.length).toBe(PERMANENT_ROLES.length);
    // No opinion was manufactured to fill the gap.
    expect(r.consensus.agreement).toEqual({ agree: 0, disagree: 0, uncertain: 0 });
    expect(r.temporaryAgents).toHaveLength(0);
    // Evidence was collected but never analysed, so it earns no confidence at all.
    expect(r.confidence.score).toBe(0);
    expect(r.confidence.caps.join(" ")).toContain("לא בוצעה חקירה");
  });

  it("records contradictions found by agents", async () => {
    const { fn } = hook((agentId) => (agentId === "evidence" ? { contradicts: ["source A contradicts source B"] } : {}));
    const r = await runInvestigation({ question: "q", observations }, fn, { persist: false });
    expect(r.contradictions.length).toBeGreaterThan(0);
    expect(r.contradictions[0].claimA).toBe("source A contradicts source B");
  });
});
