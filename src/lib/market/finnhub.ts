import { MarketDataProvider, Candle, PriceAt, Milestone, MarketHealth, usMarketSession } from "./types";
import { buildMilestones } from "./mock";
import { ProviderStats, fetchWithTimeout } from "../providers/stats";

/**
 * FinnhubProvider — finnhub.io. Requires FINNHUB_API_KEY.
 * Quote is available on the free tier; intraday candles require a paid plan, so a 403
 * there is reported honestly (empty candles + OFFLINE stats) rather than back-filled.
 */
export class FinnhubProvider implements MarketDataProvider {
  readonly key = "FinnhubProvider";
  readonly requiredEnv = ["FINNHUB_API_KEY"];
  private stats = new ProviderStats();
  private base = "https://finnhub.io/api/v1";

  private get apiKey() { return process.env.FINNHUB_API_KEY || ""; }
  private missing(): string[] { return this.apiKey ? [] : ["FINNHUB_API_KEY"]; }
  getStats() { return this.stats.snapshot(); }
  getMarketSession(tsUtc: string) { return usMarketSession(tsUtc); }

  async healthCheck(): Promise<MarketHealth> {
    const missing = this.missing();
    if (missing.length) return { key: this.key, connected: false, missingEnvKeys: missing, message: "NOT_AVAILABLE — חסר FINNHUB_API_KEY" };
    try {
      const r = await fetchWithTimeout(`${this.base}/quote?symbol=AAPL&token=${this.apiKey}`);
      if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — HTTP ${r.status}` }; }
      const j: any = await r.json().catch(() => null);
      // Finnhub answers 200 with c=0 for an invalid key or unknown symbol.
      if (!j || !j.c) { this.stats.failure("empty quote"); return { key: this.key, connected: false, missingEnvKeys: [], message: "OFFLINE — תשובה ריקה (מפתח לא תקף?)" }; }
      this.stats.success();
      return { key: this.key, connected: true, missingEnvKeys: [], message: "Connected" };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  private async json(path: string): Promise<any | null> {
    if (this.missing().length) return null;
    let r: Response;
    try { r = await fetchWithTimeout(`${this.base}${path}&token=${this.apiKey}`); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return null; }
    if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return null; }
    this.stats.success();
    return r.json().catch(() => null);
  }

  async getLatestPrice(symbol: string): Promise<PriceAt | null> {
    const j = await this.json(`/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!j?.c) return null;
    const tsUtc = new Date((j.t ? j.t * 1000 : Date.now())).toISOString();
    return { provider: this.key, symbol, tsUtc, price: j.c, marketSession: this.getMarketSession(tsUtc), usedFallback: false };
  }

  async getCandlesBetween(symbol: string, fromUtc: string, toUtc: string, interval: "1m" | "5m" | "1d"): Promise<Candle[]> {
    const res = interval === "1d" ? "D" : interval === "5m" ? "5" : "1";
    const from = Math.floor(new Date(fromUtc).getTime() / 1000);
    const to = Math.floor(new Date(toUtc).getTime() / 1000);
    const j = await this.json(`/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${res}&from=${from}&to=${to}`);
    if (!j || j.s !== "ok") return [];      // "no_data" or a plan restriction — report nothing, invent nothing
    const out: Candle[] = [];
    for (let i = 0; i < (j.t || []).length; i++) {
      const tsUtc = new Date(j.t[i] * 1000).toISOString();
      out.push({ provider: this.key, symbol, tsUtc, open: j.o[i], high: j.h[i], low: j.l[i], close: j.c[i], volume: j.v?.[i] ?? 0, marketSession: this.getMarketSession(tsUtc) });
    }
    return out;
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
