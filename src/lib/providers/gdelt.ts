import { WebSearchProvider, SearchOptions, SearchResult, ProviderHealth, QuotaStatus } from "./types";

// GdeltProvider — implements WebSearchProvider. Not wired to a live endpoint yet.
export class GdeltProvider implements WebSearchProvider {
  readonly key = "GdeltProvider";
  async healthCheck(): Promise<ProviderHealth> {
    return { key: this.key, connected: false, missingEnvKeys: [], lastCheckedAt: null,
      message: "Not Connected — implement fetch() and wire an endpoint" };
  }
  async getQuotaStatus(): Promise<QuotaStatus> {
    return { provider: this.key, used: 0, dailyQuota: Infinity, remaining: Infinity, rateLimited: false, exhausted: false };
  }
  async search(_query: string, _options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }
}
