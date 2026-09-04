import { MarketDataProvider, Candle, PriceAt, Milestone, MarketHealth, usMarketSession } from "./types";
import { buildMilestones } from "./mock";
import { ProviderStats, fetchWithTimeout } from "../providers/stats";

/**
 * AlphaVantageProvider — alphavantage.co. Requires ALPHA_VANTAGE_API_KEY.
 * The free tier is 25 requests/day and answers over-quota with HTTP 200 plus a "Note"
 * or "Information" field; that is detected and surfaced as rate-limited/OFFLINE rather
 * than parsed as an empty (and therefore misleading) price series.
 */
export class AlphaVantageProvider implements MarketDataProvider {
  readonly key = "AlphaVantageProvider";
  readonly requiredEnv = ["ALPHA_VANTAGE_API_KEY"];
  private stats = new ProviderStats();
  private base = "https://www.alphavantage.co/query";

  private get apiKey() { return process.env.ALPHA_VANTAGE_API_KEY || ""; }
  private missing(): string[] { return this.apiKey ? [] : ["ALPHA_VANTAGE_API_KEY"]; }
  getStats() { return this.stats.snapshot(); }
  getMarketSession(tsUtc: string) { return usMarketSession(tsUtc); }

  async healthCheck(): Promise<MarketHealth> {
    const missing = this.missing();
    if (missing.length) return { key: this.key, connected: false, missingEnvKeys: missing, message: "NOT_AVAILABLE — חסר ALPHA_VANTAGE_API_KEY" };
    const j = await this.query({ function: "GLOBAL_QUOTE", symbol: "AAPL" });
    if (j === "throttled") return { key: this.key, connected: false, missingEnvKeys: [], message: "OFFLINE — מכסת Alpha Vantage מוצתה להיום" };
    if (!j?.["Global Quote"]?.["05. price"]) return { key: this.key, connected: false, missingEnvKeys: [], message: "OFFLINE — תשובה ריקה (מפתח לא תקף?)" };
    return { key: this.key, connected: true, missingEnvKeys: [], message: "Connected" };
  }

  /** Returns parsed JSON, "throttled" when the free-tier note is present, or null on failure. */
  private async query(params: Record<string, string>): Promise<any | "throttled" | null> {
    if (this.missing().length) return null;
    const url = `${this.base}?${new URLSearchParams({ ...params, apikey: this.apiKey }).toString()}`;
    let r: Response;
    try { r = await fetchWithTimeout(url); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return null; }
    if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return null; }
    const j: any = await r.json().catch(() => null);
    if (j && (j.Note || j.Information)) { this.stats.failure("rate limit / quota", true); return "throttled"; }
    if (!j || j["Error Message"]) { this.stats.failure(j?.["Error Message"] || "empty response"); return null; }
    this.stats.success();
    return j;
  }

  async getLatestPrice(symbol: string): Promise<PriceAt | null> {
    const j = await this.query({ function: "GLOBAL_QUOTE", symbol });
    if (!j || j === "throttled") return null;
    const price = Number(j["Global Quote"]?.["05. price"]);
    if (!price) return null;
    const tsUtc = new Date().toISOString();
    return { provider: this.key, symbol, tsUtc, price, marketSession: this.getMarketSession(tsUtc), usedFallback: false };
  }

  async getCandlesBetween(symbol: string, fromUtc: string, toUtc: string, interval: "1m" | "5m" | "1d"): Promise<Candle[]> {
    const daily = interval === "1d";
    const j = await this.query(daily
      ? { function: "TIME_SERIES_DAILY", symbol, outputsize: "compact" }
      : { function: "TIME_SERIES_INTRADAY", symbol, interval: interval === "5m" ? "5min" : "1min", outputsize: "full" });
    if (!j || j === "throttled") return [];

    const seriesKey = Object.keys(j).find((k) => k.startsWith("Time Series"));
    if (!seriesKey) return [];
    const from = new Date(fromUtc).getTime(), to = new Date(toUtc).getTime();
    const out: Candle[] = [];
    for (const [stamp, v] of Object.entries<any>(j[seriesKey])) {
      // Alpha Vantage stamps are US/Eastern wall-clock; treat as UTC-4 to stay ordered.
      const tsUtc = new Date(`${stamp.replace(" ", "T")}${stamp.includes(" ") ? "-04:00" : "T00:00:00Z"}`).toISOString();
      const t = new Date(tsUtc).getTime();
      if (t < from || t > to) continue;
      out.push({
        provider: this.key, symbol, tsUtc,
        open: Number(v["1. open"]), high: Number(v["2. high"]), low: Number(v["3. low"]),
        close: Number(v["4. close"]), volume: Number(v["5. volume"] || 0), marketSession: this.getMarketSession(tsUtc),
      });
    }
    return out.sort((a, b) => a.tsUtc.localeCompare(b.tsUtc));
  }

  async getPriceAtTimestamp(symbol: string, tsUtc: string): Promise<PriceAt | null> {
    const session = this.getMarketSession(tsUtc);
    const target = new Date(tsUtc).getTime();
    if (session === "regular") {
      const candles = await this.getCandlesBetween(symbol, new Date(target - 10 * 60000).toISOString(), tsUtc, "1m");
      const c = candles.length ? candles[candles.length - 1] : null;
      if (c) return { provider: this.key, symbol, tsUtc, price: c.close, marketSession: session, usedFallback: false };
    }
    const dayMs = 86400000;
    const before = await this.getCandlesBetween(symbol, new Date(target - 7 * dayMs).toISOString(), tsUtc, "1d");
    const after = await this.getCandlesBetween(symbol, tsUtc, new Date(target + 7 * dayMs).toISOString(), "1d");
    const lastClose = before.length ? before[before.length - 1].close : undefined;
    const nextOpen = after.length ? after[0].open : undefined;
    if (lastClose === undefined && nextOpen === undefined) return null;
    return { provider: this.key, symbol, tsUtc, price: lastClose ?? nextOpen!, marketSession: session, usedFallback: true, lastCloseBefore: lastClose, nextOpen };
  }

  async getPriceMilestones(symbol: string, publishedAtUtc: string, amount: number, now = new Date()): Promise<Milestone[]> {
    return buildMilestones(this, symbol, publishedAtUtc, amount, now);
  }
}
