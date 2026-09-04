import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { ProviderStats, MinInterval, fetchWithTimeout, PUBLIC_UA } from "./stats";

/**
 * GdeltProvider — GDELT 2.0 Document API. Keyless global news index, useful for
 * non-English and non-US coverage that Google News misses.
 *
 * GDELT enforces roughly one request every 5 seconds and answers HTTP 429 with a plain
 * text warning when you exceed it, so calls are spaced by MinInterval and a throttled
 * response is reported as rate-limited instead of "no results".
 */
export class GdeltProvider implements WebSearchProvider {
  readonly key = "GdeltProvider";
  readonly requiredEnv: string[] = [];          // keyless
  private stats = new ProviderStats();
  private spacing = new MinInterval(5_200);     // GDELT: ~1 request / 5s
  private base = "https://api.gdeltproject.org/api/v2/doc/doc";

  getStats() { return this.stats.snapshot(); }

  private headers() { return { "user-agent": PUBLIC_UA, accept: "application/json" }; }

  private async spaced(url: string, maxWaitMs = 6_000): Promise<Response | null> {
    const wait = this.spacing.msUntilReady();
    if (wait > maxWaitMs) return null;                         // caller moves on; other providers keep working
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.spacing.mark();
    try { return await fetchWithTimeout(url, { headers: this.headers() }); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return null; }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    const r = await this.spaced(`${this.base}?query=market&mode=ArtList&format=json&maxrecords=1`);
    if (!r) return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: "OFFLINE — הגבלת קצב GDELT / שגיאת רשת" };
    if (!r.ok) {
      this.stats.failure(`HTTP ${r.status}`, r.status === 429);
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now,
        message: r.status === 429 ? "OFFLINE — GDELT rate limit (בקשה אחת ל-5 שניות)" : `OFFLINE — HTTP ${r.status}` };
    }
    this.stats.success();
    return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: "Connected — GDELT (ללא מפתח)" };
  }

  async getQuotaStatus(): Promise<QuotaStatus> {
    const s = this.stats.snapshot();
    return { provider: this.key, used: s.requests, dailyQuota: Infinity, remaining: Infinity, rateLimited: s.rateLimited, exhausted: false };
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const p = new URLSearchParams({
      query, mode: "ArtList", format: "json",
      maxrecords: String(Math.min(75, options?.maxResults ?? 15)), sort: "DateDesc",
    });
    // GDELT accepts a relative window in minutes; anything older uses its default span.
    if (options?.freshnessHours) p.set("timespan", `${Math.max(1, Math.round(options.freshnessHours * 60))}min`);

    const res = await this.spaced(`${this.base}?${p.toString()}`);
    if (!res) return [];
    if (!res.ok) { this.stats.failure(`HTTP ${res.status}`, res.status === 429); return []; }

    // Over-quota replies come back as plain text with a 200 in some cases — guard the parse.
    const body = await res.text();
    let j: any;
    try { j = JSON.parse(body); }
    catch { this.stats.failure("non-JSON response (rate limited)", true); return []; }
    this.stats.success();

    const now = new Date().toISOString();
    return (j.articles || []).map((a: any) => ({
      provider: this.key, query, title: a.title || "", url: a.url || "", domain: a.domain || domainOf(a.url || ""),
      snippet: a.title || "",
      publishedAt: parseGdeltDate(a.seendate),
      discoveredAt: now, language: (a.language || "").toLowerCase() || options?.language,
    })).filter((r: SearchResult) => r.url && r.title);
  }
}

/** GDELT stamps look like 20260904T101500Z. Anything else becomes null — never a guess. */
function parseGdeltDate(raw?: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(raw || ""));
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
}
