import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";
import { ProviderStats, fetchWithTimeout, PUBLIC_UA } from "./stats";

/**
 * SecEdgarProvider — SEC EDGAR full-text search (efts.sec.gov). Keyless, but the SEC
 * requires a descriptive User-Agent; set PUBLIC_USER_AGENT to your own contact string.
 * This is the highest-quality source in the roster: filings are primary documents, so
 * a hit here is evidence, not a report about evidence.
 */
export class SecEdgarProvider implements WebSearchProvider {
  readonly key = "SecEdgarProvider";
  readonly requiredEnv: string[] = [];          // keyless
  private stats = new ProviderStats();
  private base = "https://efts.sec.gov/LATEST/search-index";

  getStats() { return this.stats.snapshot(); }

  private headers() { return { "user-agent": PUBLIC_UA, accept: "application/json" }; }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    try {
      const r = await fetchWithTimeout(`${this.base}?q=%22market%22&forms=8-K`, { headers: this.headers() });
      if (r.ok) {
        this.stats.success();
        return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: now, message: "Connected — SEC EDGAR full-text search" };
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

  /** hit _id is "<accession>:<file>" — rebuild the canonical Archives URL from it. */
  private hitUrl(id: string, cik: string): string | null {
    const [adsh, file] = id.split(":");
    if (!adsh || !file) return null;
    return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh.replace(/-/g, "")}/${file}`;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const p = new URLSearchParams({ q: `"${query.replace(/"/g, "")}"` });
    if (options?.freshnessHours) {
      const from = new Date(Date.now() - options.freshnessHours * 3.6e6).toISOString().slice(0, 10);
      p.set("dateRange", "custom");
      p.set("startdt", from);
      p.set("enddt", new Date().toISOString().slice(0, 10));
    }

    let res: Response;
    try { res = await fetchWithTimeout(`${this.base}?${p.toString()}`, { headers: this.headers() }); }
    catch (e: any) { this.stats.failure(String(e?.message || e)); return []; }
    if (!res.ok) { this.stats.failure(`HTTP ${res.status}`, res.status === 429); return []; }
    this.stats.success();

    const j: any = await res.json();
    const now = new Date().toISOString();
    const out: SearchResult[] = [];
    for (const hit of (j?.hits?.hits || []).slice(0, options?.maxResults ?? 10)) {
      const s = hit._source || {};
      const url = this.hitUrl(String(hit._id || ""), String(s.ciks?.[0] || "0"));
      if (!url) continue;
      const filer = String(s.display_names?.[0] || "").trim();
      out.push({
        provider: this.key, query,
        title: `${s.form || "filing"} — ${filer || s.file_description || "SEC filing"}`,
        url, domain: domainOf(url),
        snippet: [s.file_description, s.form, filer].filter(Boolean).join(" · "),
        // file_date is a real filing date from the SEC; never synthesised.
        publishedAt: s.file_date ? new Date(`${s.file_date}T00:00:00Z`).toISOString() : null,
        discoveredAt: now, language: "en",
      });
    }
    return out;
  }
}
