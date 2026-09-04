import { MarketHealth } from "./types";
import { ProviderStats, fetchWithTimeout, PUBLIC_UA } from "../providers/stats";

/** Shared shape for macro/context modules (not full MarketDataProvider adapters). */
export interface MacroSeriesPoint { date: string; value: number }

/**
 * CoinGeckoProvider — crypto spot prices. Keyless on the public tier (COINGECKO_API_KEY
 * is optional and only raises rate limits). Used for the CRYPTO view and for tagging
 * crypto assets LIVE vs MOCK.
 */
export class CoinGeckoProvider {
  readonly key = "CoinGeckoProvider";
  readonly requiredEnv: string[] = [];          // keyless public tier
  private stats = new ProviderStats();
  private base = "https://api.coingecko.com/api/v3";

  getStats() { return this.stats.snapshot(); }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "user-agent": PUBLIC_UA, accept: "application/json" };
    if (process.env.COINGECKO_API_KEY) h["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
    return h;
  }

  async healthCheck(): Promise<MarketHealth> {
    try {
      const r = await fetchWithTimeout(`${this.base}/simple/price?ids=bitcoin&vs_currencies=usd`, { headers: this.headers() });
      if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — HTTP ${r.status}` }; }
      const j: any = await r.json().catch(() => null);
      if (!j?.bitcoin?.usd) { this.stats.failure("empty response"); return { key: this.key, connected: false, missingEnvKeys: [], message: "OFFLINE — תשובה ריקה" }; }
      this.stats.success();
      return { key: this.key, connected: true, missingEnvKeys: [], message: "Connected — CoinGecko (ללא מפתח)" };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  /** Spot prices in USD for CoinGecko ids. Returns {} on any failure — never a guessed price. */
  async getPrices(ids: string[]): Promise<Record<string, number>> {
    if (!ids.length) return {};
    let r: Response;
    try { r = await fetchWithTimeout(`${this.base}/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&include_24hr_change=true`, { headers: this.headers() }); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return {}; }
    if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return {}; }
    this.stats.success();
    const j: any = await r.json().catch(() => ({}));
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries<any>(j || {})) if (typeof v?.usd === "number") out[id] = v.usd;
    return out;
  }
}

/**
 * FredProvider — Federal Reserve economic series (FRED). Requires FRED_API_KEY.
 * Supplies the macro agent with real interest-rate / inflation series; without the key
 * the macro agent must say NOT_AVAILABLE instead of assuming a macro backdrop.
 */
export class FredProvider {
  readonly key = "FredProvider";
  readonly requiredEnv = ["FRED_API_KEY"];
  private stats = new ProviderStats();
  private base = "https://api.stlouisfed.org/fred";

  private get apiKey() { return process.env.FRED_API_KEY || ""; }
  private missing(): string[] { return this.apiKey ? [] : ["FRED_API_KEY"]; }
  getStats() { return this.stats.snapshot(); }

  async healthCheck(): Promise<MarketHealth> {
    const missing = this.missing();
    if (missing.length) return { key: this.key, connected: false, missingEnvKeys: missing, message: "NOT_AVAILABLE — חסר FRED_API_KEY" };
    try {
      const r = await fetchWithTimeout(`${this.base}/series/observations?series_id=DFF&limit=1&sort_order=desc&file_type=json&api_key=${this.apiKey}`);
      if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — HTTP ${r.status}` }; }
      this.stats.success();
      return { key: this.key, connected: true, missingEnvKeys: [], message: "Connected" };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  /** Latest observations for a FRED series (e.g. DFF, CPIAUCSL). Empty array on failure. */
  async getSeries(seriesId: string, limit = 12): Promise<MacroSeriesPoint[]> {
    if (this.missing().length) return [];
    let r: Response;
    try { r = await fetchWithTimeout(`${this.base}/series/observations?series_id=${encodeURIComponent(seriesId)}&limit=${limit}&sort_order=desc&file_type=json&api_key=${this.apiKey}`); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return []; }
    if (!r.ok) { this.stats.failure(`HTTP ${r.status}`, r.status === 429); return []; }
    this.stats.success();
    const j: any = await r.json().catch(() => null);
    return (j?.observations || [])
      .filter((o: any) => o.value !== ".")          // FRED marks missing points with "."; drop, never zero-fill
      .map((o: any) => ({ date: o.date, value: Number(o.value) }));
  }
}
