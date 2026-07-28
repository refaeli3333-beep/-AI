import { describe, it, expect } from "vitest";
import { QuotaTracker } from "../quota";

describe("quota", () => {
  it("tracks usage and exhaustion", async () => {
    const q = new QuotaTracker("t1", 3);
    expect((await q.status()).remaining).toBe(3);
    await q.increment(3);
    const s = await q.status();
    expect(s.remaining).toBe(0);
    expect(s.exhausted).toBe(true);
  });
  it("flags low remaining under 20%", async () => {
    const q = new QuotaTracker("t2", 10);
    await q.increment(9);
    expect(await q.lowRemaining()).toBe(true);
  });
});
