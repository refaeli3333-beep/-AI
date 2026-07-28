import { describe, it, expect } from "vitest";
import { scoreSource, countIndependentSources } from "../sourceScore";

describe("sourceScore", () => {
  it("scores government/official highest", () => {
    expect(scoreSource("gov.il").score).toBe(100);
    expect(scoreSource("sec.gov").score).toBe(95);
  });
  it("scores agencies above secondary news above blogs", () => {
    expect(scoreSource("reuters.com").score).toBeGreaterThan(scoreSource("randomsite.net").score);
    expect(scoreSource("randomsite.net").score).toBeGreaterThan(scoreSource("my.blog.medium.com").score);
  });
  it("counts copies of one source as a single independent source", () => {
    expect(countIndependentSources(["a.com", "a.com", "b.com"])).toBe(2);
  });
});
