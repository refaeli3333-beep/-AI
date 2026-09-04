import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { QuotaTracker } from "../search/quota";
import { ProviderStats, fetchWithTimeout } from "./stats";

/**
 * GoogleProgrammableSearchProvider
 * Uses the official Google Custom Search JSON API.
 * Keys come ONLY from env: GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID.
 * Google is used to FIND a source; the original source must still be opened and verified.
 */
export class GoogleProgrammableSearchProvider implements WebSearchProvider {
  readonly key = "GoogleProgrammableSearchProvider";
  readonly requiredEnv = ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"];
  private stats = new ProviderStats();
  private apiKey = process.env.GOOGLE_SEARCH_API_KEY || "";
  private engineId = process.env.GOOGLE_SEARCH_ENGINE_ID || "";
  private quota = new QuotaTracker("google", Number(process.env.GOOGLE_DAILY_QUOTA || 100));

  getStats() { return this.stats.snapshot(); }

  private missingKeys(): string[] {
    const m: string[] = [];
    if (!this.apiKey) m.push("GOOGLE_SEARCH_API_KEY");
    if (!this.engineId) m.push("GOOGLE_SEARCH_ENGINE_ID");
    return m;
  }

  async healthCheck(): Promise<ProviderHealth> {
    const missing = this.missingKeys();
    if (missing.length) {
      return { key: this.key, connected: false, missingEnvKeys: missing, lastCheckedAt: null,
        message: "NOT_AVAILABLE — חסרים מפתחות" };
    }
    // A single real test query decides connectivity. A key that EXISTS but is rejected
    // is not LIVE: 403 usually means the Custom Search JSON API is not enabled on the
    // Google Cloud project, 429 means the daily quota is spent.
    try {
      const res = await this.rawFetch("test", { maxResults: 1 });
      if (res.ok) { this.stats.success(); return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: new Date().toISOString(), message: "Connected" }; }
      const detail = res.status === 403 ? "Custom Search JSON API אינו מופעל בפרויקט Google Cloud"
        : res.status === 429 ? "מכסת Google היומית מוצתה" : `HTTP ${res.status}`;
      this.stats.failure(detail, res.status === 429);
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: new Date().toISOString(), message: `OFFLINE — ${detail}` };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: new Date().toISOString(),
        message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  async getQuotaStatus(): Promise<QuotaStatus> {
    return this.quota.status();
  }

  private buildUrl(query: string, options?: SearchOptions): string {
    const q = options?.site ? `${query} site:${options.site}` : query;
    const p = new URLSearchParams({ key: this.apiKey, cx: this.engineId, q, num: String(Math.min(10, options?.maxResults || 10)) });
    if (options?.language) p.set("lr", `lang_${options.language}`);
    if (options?.freshnessHours) p.set("dateRestrict", `h${options.freshnessHours}`);
    return `https://www.googleapis.com/customsearch/v1?${p.toString()}`;
  }

  private async rawFetch(query: string, options?: SearchOptions): Promise<Response> {
    return fetchWithTimeout(this.buildUrl(query, options));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (this.missingKeys().length) return [];        // never crash: behave as empty
    if ((await this.quota.status()).exhausted) return []; // quota gate

    let res: Response;
    try { res = await this.rawFetch(query, options); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return []; }
    await this.quota.increment(1, res.status === 429);
    if (!res.ok) { this.stats.failure(`HTTP ${res.status}`, res.status === 429); return []; }
    this.stats.success();

    const data: any = await res.json();
    const items: any[] = data.items || [];
    const now = new Date().toISOString();
    return items.map((it) => {
      // published date is only trusted if the API surfaces it; otherwise null.
      const meta = it.pagemap?.metatags?.[0] || {};
      const published = meta["article:published_time"] || meta["og:updated_time"] || null;
      return {
        provider: this.key,
        query,
        title: it.title || "",
        url: it.link || "",
        domain: domainOf(it.link || ""),
        snippet: it.snippet || "",
        publishedAt: published,        // may be null — we never invent a date
        discoveredAt: now,
        language: options?.language,
      } as SearchResult;
    });
  }
}
