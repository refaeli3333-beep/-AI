import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { ProviderStats, fetchWithTimeout, PUBLIC_UA } from "./stats";
import { parseFeed } from "./xml";

/**
 * GoogleNewsProvider — Google News RSS search. Keyless and public, so it keeps news
 * discovery working when the paid Custom Search JSON API is not enabled on the project.
 * Google News only points at a source; the source must still be opened and verified.
 */
export class GoogleNewsProvider implements WebSearchProvider {
  readonly key = "GoogleNewsProvider";
  readonly requiredEnv: string[] = [];          // keyless
  private stats = new ProviderStats();
  private base = "https://news.google.com/rss/search";

  getStats() { return this.stats.snapshot(); }

  private url(query: string, options?: SearchOptions): string {
    const loc = options?.language === "he"
      ? { hl: "he", gl: "IL", ceid: "IL:he" }
      : { hl: "en-US", gl: "US", ceid: "US:en" };
    const q = options?.site ? `${query} site:${options.site}` : query;
    return `${this.base}?${new URLSearchParams({ q, ...loc }).toString()}`;
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    try {
      const r = await fetchWithTimeout(this.url("market"), { headers: { "user-agent": PUBLIC_UA } });
      if (r.ok) {
        this.stats.success();
        return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: "Connected — Google News RSS (ללא מפתח)" };
      }
      this.stats.failure(`HTTP ${r.status}`, r.status === 429);
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: `OFFLINE — HTTP ${r.status}` };
    } catch (e: any) {
      this.stats.failure(String(e?.message || e));
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: `OFFLINE — ${e?.message || "network error"}` };
    }
  }

  async getQuotaStatus(): Promise<QuotaStatus> {
    return { provider: this.key, used: 0, dailyQuota: Infinity, remaining: Infinity, rateLimited: false, exhausted: false };
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    let res: Response;
    try { res = await fetchWithTimeout(this.url(query, options), { headers: { "user-agent": PUBLIC_UA } }); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return []; }
    if (!res.ok) { this.stats.failure(`HTTP ${res.status}`, res.status === 429); return []; }
    this.stats.success();

    const cutoff = options?.freshnessHours ? Date.now() - options.freshnessHours * 3.6e6 : null;
    const now = new Date().toISOString();
    return parseFeed(await res.text(), options?.maxResults ?? 15)
      .filter((it) => !cutoff || !it.pubDate || Date.parse(it.pubDate) >= cutoff)
      .map((it) => ({
        provider: this.key, query, title: it.title, url: it.link, domain: domainOf(it.link),
        snippet: it.description, publishedAt: it.pubDate, discoveredAt: now, language: options?.language,
      }));
  }
}
