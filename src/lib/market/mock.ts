import { MarketDataProvider, Candle, PriceAt, Milestone, MarketHealth, usMarketSession, MILESTONE_DEFS } from "./types";

// Deterministic offline market data (DEMO mode / missing key). Never networked.
function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
function basePrice(symbol: string) { return 20 + (hash(symbol) % 460); }
function priceAt(symbol: string, tsUtc: string): number {
  const base = basePrice(symbol);
  const t = new Date(tsUtc).getTime();
  const wobble = Math.sin((t / 3.6e6) + hash(symbol)) * 0.04 + Math.cos(t / 8.64e7 + hash(symbol)) * 0.08;
  return Math.round(base * (1 + wobble) * 100) / 100;
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly key = "MockMarketDataProvider";
  getMarketSession(tsUtc: string) { return usMarketSession(tsUtc); }
  async healthCheck(): Promise<MarketHealth> {
    return { key: this.key, connected: true, missingEnvKeys: [], message: "Mock market data (demo only)" };
  }
  async getLatestPrice(symbol: string): Promise<PriceAt> {
    const tsUtc = new Date().toISOString();
    return { provider: this.key, symbol, tsUtc, price: priceAt(symbol, tsUtc), marketSession: this.getMarketSession(tsUtc), usedFallback: false };
  }
  async getPriceAtTimestamp(symbol: string, tsUtc: string): Promise<PriceAt> {
    const session = this.getMarketSession(tsUtc);
    if (session === "regular") return { provider: this.key, symbol, tsUtc, price: priceAt(symbol, tsUtc), marketSession: session, usedFallback: false };
    // outside regular hours: last close before + next open, no immediate regular-session move
    const d = new Date(tsUtc);
    const before = new Date(d); before.setUTCHours(19, 55, 0, 0); if (before > d) before.setUTCDate(before.getUTCDate() - 1);
    const nextOpen = new Date(d); nextOpen.setUTCHours(13, 35, 0, 0); if (nextOpen < d) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
    return {
      provider: this.key, symbol, tsUtc, price: priceAt(symbol, before.toISOString()),
      marketSession: session, usedFallback: true,
      lastCloseBefore: priceAt(symbol, before.toISOString()), nextOpen: priceAt(symbol, nextOpen.toISOString()),
    };
  }
  async getCandlesBetween(symbol: string, fromUtc: string, toUtc: string, interval: "1m" | "5m" | "1d"): Promise<Candle[]> {
    const step = interval === "1d" ? 86400000 : interval === "5m" ? 300000 : 60000;
    const out: Candle[] = [];
    for (let t = new Date(fromUtc).getTime(); t <= new Date(toUtc).getTime(); t += step) {
      const ts = new Date(t).toISOString(); const p = priceAt(symbol, ts);
      out.push({ provider: this.key, symbol, tsUtc: ts, open: p, high: p * 1.005, low: p * 0.995, close: p, volume: 1000 + (hash(ts) % 9000), marketSession: this.getMarketSession(ts) });
      if (out.length > 500) break;
    }
    return out;
  }
  async getPriceMilestones(symbol: string, publishedAtUtc: string, amount: number, now = new Date()): Promise<Milestone[]> {
    return buildMilestones(this, symbol, publishedAtUtc, amount, now);
  }
}

// Shared milestone builder — used by every provider. Future points stay Pending.
export async function buildMilestones(
  provider: MarketDataProvider, symbol: string, publishedAtUtc: string, amount: number, now = new Date(),
): Promise<Milestone[]> {
  const base = new Date(publishedAtUtc).getTime();
  const signal = await provider.getPriceAtTimestamp(symbol, publishedAtUtc);
  const signalPrice = signal?.price ?? 0;
  const out: Milestone[] = [];
  for (const def of MILESTONE_DEFS) {
    const dueAt = new Date(base + def.mins * 60000);
    if (dueAt.getTime() > now.getTime()) { out.push({ key: def.key, label: def.label, dueAt: dueAt.toISOString(), status: "pending" }); continue; }
    const pa = await provider.getPriceAtTimestamp(symbol, dueAt.toISOString());
    const price = pa?.price ?? signalPrice;
    const changePct = signalPrice ? (price - signalPrice) / signalPrice * 100 : 0;
    const portfolioValue = signalPrice ? (amount / signalPrice) * price : amount;
    out.push({ key: def.key, label: def.label, dueAt: dueAt.toISOString(), status: "filled", price, changePct, portfolioValue, volume: pa ? undefined : undefined });
  }
  return out;
}
