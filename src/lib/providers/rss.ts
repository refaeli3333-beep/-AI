import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { ProviderStats, fetchWithTimeout, PUBLIC_UA } from "./stats";
import { parseFeed } from "./xml";

/**
 * RssProvider — direct publisher feeds. Keyless.
 *
 * Unlike a search API this pulls whole feeds and filters them locally, so it keeps
 * working when search quotas are exhausted. Feeds are overridable with RSS_FEEDS
 * (comma-separated URLs) so the list is not hard-coded policy.
 */
const DEFAULT_FEEDS = [
  "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://feeds.content.dowjones.io/public/rss/mw_topstories",
  "https://finance.yahoo.com/news/rssindex",
  "https://www.federalreserve.gov/feeds/press_all.xml",
];

export class RssProvider implements WebSearchProvider {
  readonly key = "RssProvider";
  readonly requiredEnv: string[] = [];          // keyless
  private stats = new ProviderStats();

  get feeds(): string[] {
    const custom = (process.env.RSS_FEEDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    return custom.length ? custom : DEFAULT_FEEDS;
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
    // Connected as soon as ONE feed really parses — a single dead publisher must not
    // take the whole provider offline.
    const results = await Promise.all(this.feeds.slice(0, 3).map(async (f) => {
      const xml = await this.fetchFeed(f);
      return !!xml && parseFeed(xml, 1).length > 0;
    }));
    const live = results.filter(Boolean).length;
    return live > 0
      ? { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: `Connected — ${live}/${results.length} פידים נבדקו בהצלחה` }
      : { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: "OFFLINE — אף פיד לא הגיב" };
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
      return parseFeed(xml, 40)
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
