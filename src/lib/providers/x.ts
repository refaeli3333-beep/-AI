import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus } from "./types";
import { ProviderStats, fetchWithTimeout } from "./stats";
import { QuotaTracker } from "../search/quota";

/**
 * XRecentSearchProvider — X (Twitter) API v2 recent search. Requires X_API_BEARER_TOKEN.
 *
 * X is the only source that yields a person's own words verbatim, so when it is not
 * connected the correct status is NOT_AVAILABLE: a tweet is never reconstructed from a
 * news article, and no post is ever invented. Downstream, `x: NOT_AVAILABLE` tells the
 * reader that direct-quote verification did not happen.
 */
export class XRecentSearchProvider implements WebSearchProvider {
  readonly key = "XRecentSearchProvider";
  readonly requiredEnv = ["X_API_BEARER_TOKEN"];
  private stats = new ProviderStats();
  private quota = new QuotaTracker("x", Number(process.env.X_DAILY_QUOTA || 100));
  private base = "https://api.x.com/2/tweets/search/recent";

  private get token() { return process.env.X_API_BEARER_TOKEN || ""; }
  private missing(): string[] { return this.token ? [] : ["X_API_BEARER_TOKEN"]; }
  getStats() { return this.stats.snapshot(); }

  private headers() { return { authorization: `Bearer ${this.token}` }; }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    const missing = this.missing();
    if (missing.length)
      return { key: this.key, connected: false, missingEnvKeys: missing, lastCheckedAt: null,
        message: "NOT_AVAILABLE — חסר X_API_BEARER_TOKEN; אימות ציטוט ישיר אינו מתבצע" };
    try {
      const r = await fetchWithTimeout(`${this.base}?query=markets&max_results=10`, { headers: this.headers() });
      if (r.ok) { this.stats.success(); return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: "Connected" }; }
      this.stats.failure(`HTTP ${r.status}`, r.status === 429);
      // A present token is not access. X answers 401 for a bad/expired token and 402/403
      // when the token is valid but the plan does not include recent search — reporting a
      // bare status code here made a billing/plan problem look like a missing key.
      const detail =
        r.status === 429 ? "מכסת X מוצתה / הגבלת קצב (429)"
        : r.status === 401 ? "X דחה את הטוקן (401) — X_API_BEARER_TOKEN שגוי או פג תוקף"
        : r.status === 402 ? "X החזיר 402 — הטוקן תקין אך תוכנית ה-API אינה כוללת חיפוש פוסטים אחרונים (נדרשת תוכנית בתשלום)"
        : r.status === 403 ? "X החזיר 403 — לאפליקציה אין הרשאה לנקודת הקצה הזו"
        : `HTTP ${r.status}`;
      return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: now, message: `OFFLINE — ${detail}` };
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
      query: `${query} -is:retweet`,
      max_results: String(Math.min(100, Math.max(10, options?.maxResults ?? 10))),
      "tweet.fields": "created_at,author_id,lang",
      expansions: "author_id",
      "user.fields": "username,name",
    });
    if (options?.freshnessHours) {
      // X recent search only covers the last 7 days; clamp rather than send an invalid time.
      const hours = Math.min(options.freshnessHours, 24 * 7 - 1);
      p.set("start_time", new Date(Date.now() - hours * 3.6e6).toISOString());
    }

    let res: Response;
    try { res = await fetchWithTimeout(`${this.base}?${p.toString()}`, { headers: this.headers() }); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return []; }
    await this.quota.increment(1, res.status === 429);
    if (!res.ok) { this.stats.failure(`HTTP ${res.status}`, res.status === 429); return []; }
    this.stats.success();

    const j: any = await res.json();
    const users = new Map<string, any>((j.includes?.users || []).map((u: any) => [u.id, u]));
    const now = new Date().toISOString();
    return (j.data || []).map((t: any) => {
      const u = users.get(t.author_id);
      const handle = u?.username || t.author_id;
      return {
        provider: this.key, query,
        title: `@${handle}: ${String(t.text || "").slice(0, 120)}`,
        url: `https://x.com/${handle}/status/${t.id}`,
        domain: "x.com",
        snippet: t.text || "",
        publishedAt: t.created_at || null,
        discoveredAt: now, language: t.lang || options?.language,
      } as SearchResult;
    });
  }
}
