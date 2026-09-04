import { MarketDataProvider, Candle, PriceAt, Milestone, MarketHealth, usMarketSession } from "./types";
import { buildMilestones } from "./mock";
import { ProviderStats, fetchWithTimeout, PUBLIC_UA } from "../providers/stats";

/**
 * YahooFinanceProvider — public Yahoo Finance chart endpoint. Keyless, which makes it
 * the market-data fallback when no paid vendor key is configured. It is an unofficial
 * endpoint: it can rate-limit or change without notice, so every failure is reported as
 * OFFLINE rather than silently replaced with generated prices.
 */
export class YahooFinanceProvider implements MarketDataProvider {
  readonly key = "YahooFinanceProvider";
  readonly requiredEnv: string[] = [];          // keyless
  private stats = new ProviderStats();
  private base = "https://query1.finance.yahoo.com/v8/finance/chart";

  getStats() { return this.stats.snapshot(); }
  getMarketSession(tsUtc: string) { return usMarketSession(tsUtc); }

  private headers() { return { "user-agent": PUBLIC_UA, accept: "application/json" }; }

  async healthCheck(): Promise<MarketHealth> {
    try {
      const r = await fetchWithTimeout(`${this.base}/AAPL?range=5d&interval=1d`, { headers: this.headers() });
      if (r.ok) { this.stats.success(); return { key: this.key, connected: true, missingEnvKeys: [], message: "Connected — Yahoo Finance (ללא מפתח)" }; }
      this.stats.failure(`HTTP ${r.status}`, r.status === 429);
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — HTTP ${r.status}` };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  /** Raw chart fetch. Returns null on any failure — callers must not invent a price. */
  private async chart(symbol: string, params: Record<string, string>): Promise<any | null> {
    const url = `${this.base}/${encodeURIComponent(symbol)}?${new URLSearchParams(params).toString()}`;
    let r: Response;
    try { r = await fetchWithTimeout(url, { headers: this.headers() }); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return null; }
    if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return null; }
    this.stats.success();
    const j: any = await r.json().catch(() => null);
    return j?.chart?.result?.[0] ?? null;
  }

  private toCandles(symbol: string, result: any): Candle[] {
    const ts: number[] = result?.timestamp || [];
    const q = result?.indicators?.quote?.[0] || {};
    const out: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      // Yahoo emits nulls for gaps; skip them instead of interpolating a value.
      if (q.close?.[i] == null || q.open?.[i] == null) continue;
      const tsUtc = new Date(ts[i] * 1000).toISOString();
      out.push({
        provider: this.key, symbol, tsUtc,
        open: q.open[i], high: q.high?.[i] ?? q.open[i], low: q.low?.[i] ?? q.open[i],
        close: q.close[i], volume: q.volume?.[i] ?? 0, marketSession: this.getMarketSession(tsUtc),
      });
    }
    return out;
  }

  async getLatestPrice(symbol: string): Promise<PriceAt | null> {
    const result = await this.chart(symbol, { range: "1d", interval: "1m" });
    const meta = result?.meta;
    if (!meta?.regularMarketPrice) return null;
    const tsUtc = new Date((meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
    return { provider: this.key, symbol, tsUtc, price: meta.regularMarketPrice, marketSession: this.getMarketSession(tsUtc), usedFallback: false };
  }

  async getCandlesBetween(symbol: string, fromUtc: string, toUtc: string, interval: "1m" | "5m" | "1d"): Promise<Candle[]> {
    const result = await this.chart(symbol, {
      period1: String(Math.floor(new Date(fromUtc).getTime() / 1000)),
      period2: String(Math.floor(new Date(toUtc).getTime() / 1000)),
      interval, includePrePost: "true",
    });
    return result ? this.toCandles(symbol, result) : [];
  }

  async getPriceAtTimestamp(symbol: string, tsUtc: string): Promise<PriceAt | null> {
    const session = this.getMarketSession(tsUtc);
    const target = new Date(tsUtc).getTime();

    if (session === "regular") {
      const candles = await this.getCandlesBetween(symbol, new Date(target - 10 * 60000).toISOString(), tsUtc, "1m");
      const c = candles.length ? candles[candles.length - 1] : null;
      if (c) return { provider: this.key, symbol, tsUtc, price: c.close, marketSession: session, usedFallback: false };
    }

    // Outside regular hours (or no intraday candle): last close before + next open after.
    const dayMs = 86400000;
    const before = await this.getCandlesBetween(symbol, new Date(target - 7 * dayMs).toISOString(), tsUtc, "1d");
    const after = await this.getCandlesBetween(symbol, tsUtc, new Date(target + 7 * dayMs).toISOString(), "1d");
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
