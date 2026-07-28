import { describe, it, expect, beforeEach } from "vitest";
import { createSignalIfMeaningful, SignalStore } from "../createSignal";
import { FetchedSource } from "../../source/fetchSource";
import { SearchResult } from "../../providers/types";

function memStore() {
  const signals: any[] = [], assets: any[] = [], milestones: any[] = [];
  const hashes = new Set<string>();
  const store: SignalStore = {
    isDuplicateSignal: async (h) => hashes.has(h),
    saveSignal: async (row) => { hashes.add(row.content_hash); signals.push(row); return row.id; },
    saveSignalAsset: async (row) => { assets.push(row); },
    saveMilestone: async (id, m) => { milestones.push({ id, ...m }); },
    emitAlert: async () => {},
  };
  return { store, signals, assets, milestones };
}
const mkResult = (): SearchResult => ({
  provider: "MockSearchProvider", query: "q", title: "t", url: "https://ex.com/a", domain: "ex.com",
  snippet: "s", publishedAt: "2026-07-06T15:00:00Z", discoveredAt: "2026-07-06T15:00:00Z",
});
const mkSource = (text: string, published: string | null): FetchedSource => ({
  canonicalUrl: "https://ex.com/a", title: "t", author: null, language: "en",
  rawText: text, extractedText: text, directQuotes: ['"we will invest billions in AI data centers"'],
  publishedAt: published, fetchStatus: "ok", contentHash: "hash-" + text.length,
});

describe("createSignalIfMeaningful (pipeline)", () => {
  beforeEach(() => { process.env.APP_MODE = "DEMO"; });

  it("creates a signal for a market-meaningful statement", async () => {
    const { store, signals, assets, milestones } = memStore();
    const res = await createSignalIfMeaningful(
      { result: mkResult(), personName: "Demo Person", now: new Date("2026-07-11T15:00:00Z"),
        _source: mkSource("We will invest billions in artificial intelligence and data center chips.", "2026-07-06T15:00:00Z") },
      store);
    expect(res.created).toBe(true);
    expect(signals.length).toBe(1);
    expect(assets.length).toBeGreaterThanOrEqual(1);       // signal_assets created
    expect(assets[0].price_at_signal).toBeGreaterThan(0);  // price_at_signal stored
    expect(milestones.some((m) => m.status === "pending")).toBe(true); // future milestones pending
    expect(res.dataCompleteness).toBeGreaterThan(0);
  });

  it("rejects an item with no market meaning", async () => {
    const { store } = memStore();
    const res = await createSignalIfMeaningful(
      { result: mkResult(), personName: "X", _source: mkSource("The weather today is pleasant and sunny.", "2026-07-06T15:00:00Z") },
      store);
    expect(res.created).toBe(false);
    expect(res.rejectionReason).toBeTruthy();
  });

  it("prevents duplicate signals", async () => {
    const { store } = memStore();
    const args = { result: mkResult(), personName: "X", now: new Date("2026-07-11T15:00:00Z"),
      _source: mkSource("Investment in AI chips and data centers.", "2026-07-06T15:00:00Z") };
    const first = await createSignalIfMeaningful(args as any, store);
    const second = await createSignalIfMeaningful(args as any, store);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.rejectionReason).toContain("כפול");
  });
});
