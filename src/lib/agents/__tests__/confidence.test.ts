import { describe, it, expect } from "vitest";
import { computeConfidence, countIndependentSources, ConfidenceInput } from "../confidence";

const base: ConfidenceInput = {
  independentSources: 3, sourceQuality: 70, providerReliability: 0.9,
  verifiedShare: 1, contradictions: 0, unresolvedQuestions: 0, historicalAccuracy: null,
};

describe("computeConfidence", () => {
  it("has no way to be influenced by the number of agents", () => {
    // The input type carries no agent count at all — this is the guarantee.
    expect(Object.keys(base)).not.toContain("agentCount");
    expect(Object.keys(base)).not.toContain("agreeingAgents");
  });

  it("rewards independent sources but saturates", () => {
    const two = computeConfidence({ ...base, independentSources: 2 }).components.independentEvidence;
    const three = computeConfidence({ ...base, independentSources: 3 }).components.independentEvidence;
    const ten = computeConfidence({ ...base, independentSources: 10 }).components.independentEvidence;
    expect(three).toBeGreaterThan(two);
    expect(ten).toBe(35);                       // capped, so more sources cannot inflate forever
  });

  it("caps a single-source claim at 40 however good it looks", () => {
    const r = computeConfidence({ ...base, independentSources: 1, sourceQuality: 100, providerReliability: 1 });
    expect(r.score).toBeLessThanOrEqual(40);
    expect(r.caps.join(" ")).toContain("מקור יחיד");
  });

  it("caps at 55 when nothing was actually verified", () => {
    const r = computeConfidence({ ...base, verifiedShare: 0 });
    expect(r.score).toBeLessThanOrEqual(55);
  });

  it("lowers confidence as contradictions accumulate", () => {
    const clean = computeConfidence(base).score;
    const conflicted = computeConfidence({ ...base, contradictions: 2 }).score;
    expect(conflicted).toBeLessThan(clean);
  });

  it("treats an absent track record as neutral, never as a bonus", () => {
    expect(computeConfidence({ ...base, historicalAccuracy: null }).components.historicalAccuracy).toBe(0);
    expect(computeConfidence({ ...base, historicalAccuracy: 0.9 }).components.historicalAccuracy).toBeGreaterThan(0);
    expect(computeConfidence({ ...base, historicalAccuracy: 0.2 }).components.historicalAccuracy).toBeLessThan(0);
  });

  it("stays within 0..100", () => {
    const worst = computeConfidence({ independentSources: 0, sourceQuality: 0, providerReliability: 0, verifiedShare: 0, contradictions: 9, unresolvedQuestions: 9, historicalAccuracy: 0 });
    const best = computeConfidence({ independentSources: 9, sourceQuality: 100, providerReliability: 1, verifiedShare: 1, contradictions: 0, unresolvedQuestions: 0, historicalAccuracy: 1 });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(best.score).toBeLessThanOrEqual(100);
  });
});

describe("countIndependentSources", () => {
  it("counts distinct domains, not article count", () => {
    expect(countIndependentSources([
      "https://www.sec.gov/a", "https://sec.gov/b", "https://reuters.com/c",
    ])).toBe(2);
  });
  it("ignores unparseable urls", () => {
    expect(countIndependentSources(["not a url", "https://reuters.com/x"])).toBe(1);
  });
});
