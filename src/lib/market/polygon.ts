import { MarketDataProvider, Candle, PriceAt, Milestone, MarketHealth, usMarketSession } from "./types";
import { buildMilestones } from "./mock";
import { ProviderStats } from "../providers/stats";

/**
 * PolygonMarketDataProvider — real adapter over Polygon.io (US stocks, intraday,
 * historical, volume, exact UTC timestamps, 1m/5m candles). Chosen because it exposes
 * minute aggregates + previous-close, which is what price-at-publication needs.
 * Swappable: nothing outside this file references Polygon directly.
 */
export class PolygonMarketDataProvider implements MarketDataProvider {
  readonly key = "PolygonMarketDataProvider";
  readonly requiredEnv = ["MARKET_DATA_API_KEY"];
  private stats = new ProviderStats();
  private apiKey = process.env.MARKET_DATA_API_KEY || "";
  private base = "https://api.polygon.io";

  private missing(): string[] { return this.apiKey ? [] : ["MARKET_DATA_API_KEY"]; }
  getStats() { return this.stats.snapshot(); }
  getMarketSession(tsUtc: string) { return usMarketSession(tsUtc); }

  async healthCheck(): Promise<MarketHealth> {
    if (this.missing().length) return { key: this.key, connected: false, missingEnvKeys: this.missing(), message: "NOT_AVAILABLE — חסר MARKET_DATA_API_KEY" };
    try {
      const r = await fetch(`${this.base}/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${this.apiKey}`);
      if (r.ok) { this.stats.success(); return { key: this.key, connected: true, missingEnvKeys: [], message: "Connected" }; }
      this.stats.failure(`HTTP ${r.status}`, r.status === 429);
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — HTTP ${r.status}` };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  async getLatestPrice(symbol: string): Promise<PriceAt | null> {
    if (this.missing().length) return null;
    const r = await fetch(`${this.base}/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${this.apiKey}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    const c = j.results?.[0];
    if (!c) return null;
    const tsUtc = new Date(c.t).toISOString();
    return { provider: this.key, symbol, tsUtc, price: c.c, marketSession: this.getMarketSession(tsUtc), usedFallback: false };
  }

  async getCandlesBetween(symbol: string, fromUtc: string, toUtc: string, interval: "1m" | "5m" | "1d"): Promise<Candle[]> {
    if (this.missing().length) return [];
    const mult = interval === "1d" ? "1/day" : interval === "5m" ? "5/minute" : "1/minute";
    const from = new Date(fromUtc).getTime(), to = new Date(toUtc).getTime();
    const r = await fetch(`${this.base}/v2/aggs/ticker/${symbol}/range/${mult}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${this.apiKey}`);
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j.results || []).map((c: any) => {
      const tsUtc = new Date(c.t).toISOString();
      return { provider: this.key, symbol, tsUtc, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v, marketSession: this.getMarketSession(tsUtc) };
    });
  }

  async getPriceAtTimestamp(symbol: string, tsUtc: string): Promise<PriceAt | null> {
    if (this.missing().length) return null;
    const session = this.getMarketSession(tsUtc);
    const target = new Date(tsUtc).getTime();

    if (session === "regular") {
      // pick the minute candle at or just before the timestamp
      const candles = await this.getCandlesBetween(symbol, new Date(target - 6 * 60000).toISOString(), tsUtc, "1m");
      const c = candles.length ? candles[candles.length - 1] : null;
      if (c) return { provider: this.key, symbol, tsUtc, price: c.close, marketSession: session, usedFallback: false };
    }

    // outside regular hours (or no intraday candle): last close before + next open
    const dayMs = 86400000;
    const before = await this.getCandlesBetween(symbol, new Date(target - 4 * dayMs).toISOString(), tsUtc, "1d");
    const after = await this.getCandlesBetween(symbol, tsUtc, new Date(target + 4 * dayMs).toISOString(), "1d");
    const lastClose = before.length ? before[before.length - 1].close : undefined;
    const nextOpen = after.length ? after[0].open : undefined;
    if (lastClose === undefined && nextOpen === undefined) return null;
    return {
      provider: this.key, symbol, tsUtc, price: lastClose ?? nextOpen!,
      marketSession: session, usedFallback: true, lastCloseBefore: lastClose, nextOpen,
    };
  }

  async getPriceMilestones(symbol: string, publishedAtUtc: string, amount: number, now = new Date()): Promise<Milestone[]> {
    return buildMilestones(this, symbol, publishedAtUtc, amount, now);
  }
}
