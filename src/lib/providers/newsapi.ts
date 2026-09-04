import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { ProviderStats, fetchWithTimeout } from "./stats";
import { QuotaTracker } from "../search/quota";

/**
 * NewsApiProvider — newsapi.org /v2/everything. Requires NEWSAPI_KEY.
 * Without the key it reports NOT_AVAILABLE and returns nothing; it never
 * substitutes invented articles for real ones.
 */
export class NewsApiProvider implements WebSearchProvider {
  readonly key = "NewsApiProvider";
  readonly requiredEnv = ["NEWSAPI_KEY"];
  private stats = new ProviderStats();
  private quota = new QuotaTracker("newsapi", Number(process.env.NEWSAPI_DAILY_QUOTA || 100));
  private base = "https://newsapi.org/v2/everything";

  private get apiKey() { return process.env.NEWSAPI_KEY || ""; }
  private missing(): string[] { return this.apiKey ? [] : ["NEWSAPI_KEY"]; }
  getStats() { return this.stats.snapshot(); }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    const missing = this.missing();
    if (missing.length)
      return { key: this.key, connected: false, missingEnvKeys: missing, lastCheckedAt: null, message: "NOT_AVAILABLE — חסר NEWSAPI_KEY" };
    try {
      const r = await fetchWithTimeout(`${this.base}?q=market&pageSize=1&apiKey=${this.apiKey}`);
      if (r.ok) { this.stats.success(); return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: "Connected" }; }
      this.stats.failure(`HTTP ${r.status}`, r.status === 429);
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: `OFFLINE — HTTP ${r.status}` };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  async getQuotaStatus(): Promise<QuotaStatus> { return this.quota.status(); }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (this.missing().length || !query.trim()) return [];
    if ((await this.quota.status()).exhausted) return [];

    const p = new URLSearchParams({
      q: query, pageSize: String(Math.min(50, options?.maxResults ?? 15)),
      sortBy: "publishedAt", apiKey: this.apiKey,
    });
    if (options?.language) p.set("language", options.language);
    if (options?.freshnessHours) p.set("from", new Date(Date.now() - options.freshnessHours * 3.6e6).toISOString());
    if (options?.site) p.set("domains", options.site);

    let res: Response;
    try { res = await fetchWithTimeout(`${this.base}?${p.toString()}`); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return []; }
    await this.quota.increment(1, res.status === 429);
    if (!res.ok) { this.stats.failure(`HTTP ${res.status}`, res.status === 429); return []; }
    this.stats.success();

    const j: any = await res.json();
    const now = new Date().toISOString();
    return (j.articles || [])
      .map((a: any) => ({
        provider: this.key, query, title: a.title || "", url: a.url || "", domain: domainOf(a.url || ""),
        snippet: a.description || "", publishedAt: a.publishedAt || null, discoveredAt: now, language: options?.language,
      }))
      .filter((r: SearchResult) => r.url && r.title);
  }
}
