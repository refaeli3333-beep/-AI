import { describe, it, expect } from "vitest";
import { EconomicImpactInvestigationEngine } from "../engine";

const eng = new EconomicImpactInvestigationEngine();

describe("EconomicImpactInvestigationEngine", () => {
  it("detects need, technologies, components and companies for an AI statement", () => {
    const r = eng.investigate({ text: "We will significantly expand AI infrastructure.", sectors: ["ai"], eventStage: "plan" });
    expect(r.insufficient).toBeFalsy();
    expect(r.economicNeed).toContain("כוח מחשוב");
    expect(r.requiredTechnologies.length).toBeGreaterThan(3);
    expect(r.requiredComponents.length).toBeGreaterThan(0);
    expect(r.companies.length).toBeGreaterThan(0);
  });

  it("maps a direct beneficiary AND hidden suppliers (not only the obvious one)", () => {
    const r = eng.investigate({ text: "AI data center investment", sectors: ["ai"], eventStage: "budget_approval" });
    const tickers = r.companies.map((c) => c.ticker);
    expect(r.directBeneficiaries).toContain("NVDA");     // direct
    expect(r.hiddenSuppliers.length).toBeGreaterThan(0); // e.g. MU/ASML/VRT
    expect(tickers.length).toBeLessThanOrEqual(5);
  });

  it("every company link carries evidence with a source url", () => {
    const r = eng.investigate({ text: "defense budget increase", sectors: ["defense"], eventStage: "budget_approval" });
    const withCap = r.companies.filter((c) => c.evidence.length > 0);
    expect(withCap.length).toBeGreaterThan(0);
    withCap.forEach((c) => expect(c.evidence[0].sourceUrl).toMatch(/^https?:\/\//));
  });

  it("returns insufficient when no technology/company matches", () => {
    const r = eng.investigate({ text: "nice weather", sectors: [], eventStage: "statement" });
    expect(r.insufficient).toBe(true);
    expect(r.note).toContain("אין כרגע מספיק ראיות");
  });

  it("hint stage is far from revenue; contract stage is closer", () => {
    const hint = eng.investigate({ text: "AI hint", sectors: ["ai"], eventStage: "hint" });
    const contract = eng.investigate({ text: "AI contract signed", sectors: ["ai"], eventStage: "signed_contract" });
    const hintC = hint.companies[0], conC = contract.companies[0];
    expect(hintC.distanceToRevenue).toBe("long");
    expect(["short", "medium"]).toContain(conC.distanceToRevenue);
  });

  it("flags a strong connection whose price has not reacted", () => {
    const r = eng.investigate({
      text: "AI infrastructure", sectors: ["ai"], eventStage: "budget_approval",
      priceChange: { NVDA: { changeH1Pct: 0.1, changeNowPct: 0.2, reacted: false } },
    });
    const nvda = r.companies.find((c) => c.ticker === "NVDA");
    expect(nvda?.reactionCategory).toContain("עדיין לא הגיב");
  });

  it("computes opportunity, risk, already-priced-in and confidence per company", () => {
    const r = eng.investigate({ text: "AI investment", sectors: ["ai"], eventStage: "plan" });
    const c = r.companies[0];
    [c.opportunityScore, c.riskScore, c.alreadyPricedInScore, c.confidenceScore].forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100);
    });
  });
});
