import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus, domainOf } from "./types";

// Deterministic offline provider used in DEMO mode and when keys are missing.
export class MockSearchProvider implements WebSearchProvider {
  readonly key = "MockSearchProvider";
  async healthCheck(): Promise<ProviderHealth> {
    return { key: this.key, connected: true, missingEnvKeys: [], lastCheckedAt: new Date().toISOString(),
      message: "Mock provider (demo data only)" };
  }
  async getQuotaStatus(): Promise<QuotaStatus> {
    return { provider: this.key, used: 0, dailyQuota: Infinity, remaining: Infinity, rateLimited: false, exhausted: false };
  }
  async search(query: string, _options?: SearchOptions): Promise<SearchResult[]> {
    const now = new Date().toISOString();
    // deterministic labeled demo statement carrying a sector, so the full pipeline can run
    // when real providers are absent. Clearly marked as demo — never a real quote.
    const DEMO = [
      "spoke about investing billions in artificial intelligence and data center chips",
      "referenced a significant increase in the defense budget for missiles and radar",
      "discussed oil and energy supply and power grid capacity",
    ];
    let h = 5381; for (let i = 0; i < query.length; i++) h = ((h << 5) + h + query.charCodeAt(i)) >>> 0;
    const stmt = DEMO[h % DEMO.length];
    const url = `https://example.com/demo/${encodeURIComponent(query).slice(0, 40)}-${h % 1000}`;
    return [{
      provider: this.key, query,
      title: `דוגמה לצורכי הדגמה בלבד — ${query}`,
      url, domain: domainOf(url),
      snippet: `דוגמה לצורכי הדגמה בלבד (לא ציטוט אמיתי): the figure ${stmt}.`,
      publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(), discoveredAt: now,
    }];
  }
}
