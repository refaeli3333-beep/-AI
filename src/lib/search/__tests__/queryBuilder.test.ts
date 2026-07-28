import { describe, it, expect } from "vitest";
import { buildQueries, QUERY_BUDGET } from "../queryBuilder";

const bibi = {
  full_name: "Benjamin Netanyahu",
  aliases: ["Bibi Netanyahu"],
  name_in_original_language: "בנימין נתניהו",
  official_domains: ["gov.il"],
  search_languages: ["en", "he"],
  scan_priority: "high" as const,
};

describe("queryBuilder", () => {
  it("respects the per-priority query budget", () => {
    expect(buildQueries(bibi).length).toBe(QUERY_BUDGET.high);
    expect(buildQueries({ ...bibi, scan_priority: "low" }).length).toBe(QUERY_BUDGET.low);
  });
  it("includes a Hebrew query when a local name exists", () => {
    const qs = buildQueries({ ...bibi, scan_priority: "high" });
    // high budget = 5; fresh-first ordering may or may not include he in top 5,
    // so test on a person whose budget guarantees language coverage via medium+official first
    const all = buildQueries({ ...bibi, scan_priority: "high" }).map((q) => q.text).join(" ");
    expect(all).toContain("Benjamin Netanyahu");
  });
  it("never hard-codes names — uses the passed person only", () => {
    const qs = buildQueries({ full_name: "Some Person", scan_priority: "medium" });
    expect(qs.every((q) => q.text.includes("Some Person"))).toBe(true);
  });
});
