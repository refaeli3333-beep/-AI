import { describe, it, expect } from "vitest";
import { MockMarketDataProvider } from "../mock";
import { usMarketSession } from "../types";

describe("market data (mock)", () => {
  const m = new MockMarketDataProvider();
  it("classifies regular vs closed sessions", () => {
    expect(usMarketSession("2026-07-13T15:00:00Z")).toBe("regular"); // Monday 15:00 UTC
    expect(usMarketSession("2026-07-11T15:00:00Z")).toBe("closed");  // Saturday
    expect(usMarketSession("2026-07-13T10:00:00Z")).toBe("pre");
  });
  it("uses fallback (last close + next open) outside regular hours", async () => {
    const pa = await m.getPriceAtTimestamp("NVDA", "2026-07-13T02:00:00Z"); // overnight
    expect(pa.usedFallback).toBe(true);
    expect(pa.lastCloseBefore).toBeDefined();
    expect(pa.nextOpen).toBeDefined();
  });
  it("does not use fallback during regular hours", async () => {
    const pa = await m.getPriceAtTimestamp("NVDA", "2026-07-13T15:00:00Z");
    expect(pa.usedFallback).toBe(false);
  });
  it("marks future milestones Pending and past milestones Filled", async () => {
    const published = "2026-07-13T15:00:00Z";
    const now = new Date("2026-07-14T15:00:00Z"); // 1 day later
    const ms = await m.getPriceMilestones("NVDA", published, 200, now);
    const byKey = Object.fromEntries(ms.map((x) => [x.key, x.status]));
    expect(byKey["signal"]).toBe("filled");
    expect(byKey["h1"]).toBe("filled");
    expect(byKey["d1"]).toBe("filled");
    expect(byKey["d7"]).toBe("pending");  // 7 days > 1 day elapsed
    expect(byKey["d30"]).toBe("pending");
  });
});
