import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { QuotaTracker } from "../search/quota";

/**
 * GoogleProgrammableSearchProvider
 * Uses the official Google Custom Search JSON API.
 * Keys come ONLY from env: GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID.
 * Google is used to FIND a source; the original source must still be opened and verified.
 */
export class GoogleProgrammableSearchProvider implements WebSearchProvider {
  readonly key = "GoogleProgrammableSearchProvider";
  private apiKey = process.env.GOOGLE_SEARCH_API_KEY || "";
  private engineId = process.env.GOOGLE_SEARCH_ENGINE_ID || "";
  private quota = new QuotaTracker("google", Number(process.env.GOOGLE_DAILY_QUOTA || 100));

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
        message: "חסרים מפתחות — הספק במצב Not Connected" };
    }
    // A single real test query decides connectivity.
    try {
      const res = await this.rawFetch("test", { maxResults: 1 });
      return { key: this.key, connected: res.ok, missingEnvKeys: [], lastCheckedAt: new Date().toISOString(),
        message: res.ok ? "Connected" : `בדיקה נכשלה (HTTP ${res.status})` };
    } catch (e: any) {
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: new Date().toISOString(),
        message: `שגיאה: ${e?.message || "unknown"}` };
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
    return fetch(this.buildUrl(query, options));
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (this.missingKeys().length) return [];        // never crash: behave as empty
    if ((await this.quota.status()).exhausted) return []; // quota gate

    const res = await this.rawFetch(query, options);
    await this.quota.increment(1, res.status === 429);
    if (!res.ok) return [];

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
