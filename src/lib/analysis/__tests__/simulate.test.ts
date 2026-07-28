import { describe, it, expect } from "vitest";
import { simulate, reactionMetrics } from "../simulate";

describe("simulate", () => {
  it("computes fractional units", () => {
    expect(simulate(200, 125, 125).units).toBeCloseTo(1.6, 9);
  });
  it("profit: 100 -> 120 on $200 = +$40 / +20%", () => {
    const r = simulate(200, 100, 120);
    expect(r.profitLoss).toBeCloseTo(40, 9);
    expect(r.profitLossPercent).toBeCloseTo(20, 9);
  });
  it("throws on zero entry price (division guard)", () => {
    expect(() => simulate(200, 0, 100)).toThrow();
  });
  it("reaction metrics find first 1% cross and peak", () => {
    const path = [{ key: "signal", price: 100 }, { key: "h1", price: 101.5 }, { key: "d1", price: 108 }, { key: "now", price: 104 }];
    const m = reactionMetrics(path);
    expect(m.t1?.key).toBe("h1");
    expect(m.peak.price).toBe(108);
  });
});
