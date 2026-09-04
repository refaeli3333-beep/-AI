import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { ProviderStats, fetchWithTimeout, PUBLIC_UA } from "./stats";
import { parseFeed } from "./xml";

/**
 * OfficialProvider — primary/official sources only: regulators, central banks, and
 * government press rooms. Keyless.
 *
 * These carry the highest source-reliability weight because they are the origin of a
 * claim rather than a report about it. Extendable via OFFICIAL_FEEDS (comma-separated).
 */
const DEFAULT_OFFICIAL_FEEDS = [
  "https://www.sec.gov/news/pressreleases.rss",
  "https://www.federalreserve.gov/feeds/press_monetary.xml",
  "https://home.treasury.gov/news/press-releases/feed",
  "https://www.whitehouse.gov/presidential-actions/feed/",
  "https://www.ecb.europa.eu/rss/press.html",
];

export class OfficialProvider implements WebSearchProvider {
  readonly key = "OfficialProvider";
  readonly requiredEnv: string[] = [];          // keyless
  private stats = new ProviderStats();

  get feeds(): string[] {
    const custom = (process.env.OFFICIAL_FEEDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    return custom.length ? custom : DEFAULT_OFFICIAL_FEEDS;
  }

  getStats() { return this.stats.snapshot(); }

  private async fetchFeed(url: string): Promise<string | null> {
    let r: Response;
    try { r = await fetchWithTimeout(url, { headers: { "user-agent": PUBLIC_UA, accept: "application/rss+xml, application/xml, text/xml" } }); }
    catch (e: any) { this.stats.failure(`${domainOf(url)}: ${e?.message || e}`); return null; }
    if (!r.ok) { this.stats.failure(`${domainOf(url)}: HTTP ${r.status}`, r.status === 429); return null; }
    this.stats.success();
    return r.text();
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    const results = await Promise.all(this.feeds.slice(0, 3).map(async (f) => {
      const xml = await this.fetchFeed(f);
      return !!xml && parseFeed(xml, 1).length > 0;
    }));
    const live = results.filter(Boolean).length;
    return live > 0
      ? { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: `Connected — ${live}/${results.length} מקורות רשמיים נבדקו` }
      : { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: "OFFLINE — אף מקור רשמי לא הגיב" };
  }

  async getQuotaStatus(): Promise<QuotaStatus> {
    return { provider: this.key, used: 0, dailyQuota: Infinity, remaining: Infinity, rateLimited: false, exhausted: false };
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const terms = query.toLowerCase().replace(/["()]/g, " ").split(/\s+(?:or|and)\s+|\s+/).map((t) => t.trim()).filter((t) => t.length > 2);
    const cutoff = options?.freshnessHours ? Date.now() - options.freshnessHours * 3.6e6 : null;
    const now = new Date().toISOString();
    const feeds = options?.site ? this.feeds.filter((f) => f.includes(options.site!)) : this.feeds;

    const batches = await Promise.all(feeds.map(async (feed) => {
      const xml = await this.fetchFeed(feed);
      if (!xml) return [] as SearchResult[];
      return parseFeed(xml, 30)
        .filter((it) => !cutoff || !it.pubDate || Date.parse(it.pubDate) >= cutoff)
        .filter((it) => {
          if (!terms.length) return true;
          const hay = `${it.title} ${it.description}`.toLowerCase();
          return terms.some((t) => hay.includes(t));
        })
        .map((it) => ({
          provider: this.key, query, title: it.title, url: it.link, domain: domainOf(it.link),
          snippet: it.description, publishedAt: it.pubDate, discoveredAt: now, language: options?.language,
        } as SearchResult));
    }));

    return batches.flat().slice(0, options?.maxResults ?? 20);
  }
}
