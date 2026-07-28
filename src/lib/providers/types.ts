// Unified web-search provider interface. Google is only ONE implementation.
export interface SearchOptions {
  language?: string;          // "en", "he", ...
  freshnessHours?: number;    // restrict to recent results when supported
  maxResults?: number;
  site?: string;              // e.g. "gov.il" for site: restriction
}

export interface SearchResult {
  provider: string;
  query: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt: string | null; // ISO or null — never invent a date
  discoveredAt: string;       // ISO, when we saw it
  language?: string;
}

export interface ProviderHealth {
  key: string;
  connected: boolean;
  missingEnvKeys: string[];
  lastCheckedAt: string | null;
  message: string;
}

export interface QuotaStatus {
  provider: string;
  used: number;
  dailyQuota: number;
  remaining: number;
  rateLimited: boolean;
  exhausted: boolean;
}

export interface WebSearchProvider {
  readonly key: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  healthCheck(): Promise<ProviderHealth>;
  getQuotaStatus(): Promise<QuotaStatus>;
}

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
