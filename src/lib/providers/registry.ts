import { GoogleProgrammableSearchProvider } from "./google";
import { GoogleNewsProvider } from "./googleNews";
import { NewsApiProvider } from "./newsapi";
import { GdeltProvider } from "./gdelt";
import { RssProvider } from "./rss";
import { OfficialProvider } from "./official";
import { SecEdgarProvider } from "./secEdgar";
import { XRecentSearchProvider } from "./x";
import { WebSearchProvider } from "./types";
import { YahooFinanceProvider } from "../market/yahoo";
import { FinnhubProvider } from "../market/finnhub";
import { AlphaVantageProvider } from "../market/alphaVantage";
import { PolygonMarketDataProvider } from "../market/polygon";
import { CoinGeckoProvider, FredProvider } from "../market/macro";
import { recordCheck, persistState, getSyncState } from "./syncState";

export type ProviderCategory = "search" | "market" | "macro";
export interface ProviderStatus {
  key: string; label: string; category: ProviderCategory;
  connected: boolean; state: "CONNECTED" | "OFFLINE";
  message: string; missingEnvKeys: string[]; requiresKey: boolean;
  lastCheckedAt: string | null;
  requests?: number; errors?: number; lastError?: string | null; lastSuccessAt?: string | null; rateLimited?: boolean;
  lastSuccessfulSyncAt?: string | null; recordsCollected?: number; lastRunResultCount?: number | null;
}

// Singletons: keeps per-provider stats, cache and rate-limit state across requests.
const SINGLETONS = new Map<string, any>();
function singleton<T>(key: string, make: () => T): T {
  if (!SINGLETONS.has(key)) SINGLETONS.set(key, make());
  return SINGLETONS.get(key) as T;
}

/** All search-capable sources (server-side only). */
export function searchProviders(): WebSearchProvider[] {
  return [
    singleton("XRecentSearchProvider", () => new XRecentSearchProvider()),
    singleton("GoogleProgrammableSearchProvider", () => new GoogleProgrammableSearchProvider()),
    singleton("GoogleNewsProvider", () => new GoogleNewsProvider()),
    singleton("NewsApiProvider", () => new NewsApiProvider()),
    singleton("GdeltProvider", () => new GdeltProvider()),
    singleton("RssProvider", () => new RssProvider()),
    singleton("OfficialProvider", () => new OfficialProvider()),
    singleton("SecEdgarProvider", () => new SecEdgarProvider()),
  ];
}

/** Look up any module (search/market/macro) by its key. */
export function providerByKey(key: string): any | null {
  return allModules().find((m) => m.p.key === key)?.p ?? null;
}

/** Only providers that pass a REAL health check right now. Used by Scan Now. */
export async function connectedSearchProviders(): Promise<WebSearchProvider[]> {
  const list = searchProviders();
  const checks = await Promise.all(list.map(async (p) => {
    try {
      const h = await p.healthCheck();
      recordCheck(p.key, h.connected, h.message);
      await persistState(p.key, h.connected, h.missingEnvKeys || []);
      return h.connected ? p : null;
    } catch { return null; }
  }));
  return checks.filter(Boolean) as WebSearchProvider[];
}

const LABELS: Record<string, string> = {
  XRecentSearchProvider: "X (פוסטים ישירים)",
  GoogleProgrammableSearchProvider: "Google Programmable Search",
  GoogleNewsProvider: "Google News",
  NewsApiProvider: "NewsAPI",
  GdeltProvider: "GDELT",
  RssProvider: "RSS",
  OfficialProvider: "מקורות רשמיים / IR / ממשלה",
  SecEdgarProvider: "SEC EDGAR",
  YahooFinanceProvider: "Yahoo Finance",
  FinnhubProvider: "Finnhub",
  AlphaVantageProvider: "Alpha Vantage",
  PolygonMarketDataProvider: "Polygon.io",
  CoinGeckoProvider: "CoinGecko",
  FredProvider: "FRED",
};

export function allModules(): { p: any; category: ProviderCategory }[] {
  return [
    ...searchProviders().map((p) => ({ p, category: "search" as const })),
    { p: singleton("YahooFinanceProvider", () => new YahooFinanceProvider()), category: "market" as const },
    { p: singleton("FinnhubProvider", () => new FinnhubProvider()), category: "market" as const },
    { p: singleton("AlphaVantageProvider", () => new AlphaVantageProvider()), category: "market" as const },
    { p: singleton("PolygonMarketDataProvider", () => new PolygonMarketDataProvider()), category: "market" as const },
    { p: singleton("CoinGeckoProvider", () => new CoinGeckoProvider()), category: "macro" as const },
    { p: singleton("FredProvider", () => new FredProvider()), category: "macro" as const },
  ];
}

/**
 * Live status of every module. A provider is CONNECTED only after a real successful
 * request; otherwise OFFLINE with the true reason. Never reports LIVE without a probe.
 */
export async function providerStatuses(): Promise<ProviderStatus[]> {
  const mods = allModules();
  return Promise.all(mods.map(async ({ p, category }) => {
    let health: any;
    try { health = await p.healthCheck(); }
    catch (e: any) { health = { key: p.key, connected: false, missingEnvKeys: [], message: `OFFLINE — ${String(e?.message || e)}`, lastCheckedAt: new Date().toISOString() }; }
    const stats = typeof p.getStats === "function" ? p.getStats() : undefined;
    const requiredEnv: string[] = p.requiredEnv || [];
    recordCheck(p.key, !!health.connected, health.message || "");
    await persistState(p.key, !!health.connected, health.missingEnvKeys || []);
    const sync = getSyncState(p.key);
    return {
      key: p.key, label: LABELS[p.key] || p.key, category,
      connected: !!health.connected, state: health.connected ? "CONNECTED" : "OFFLINE",
      message: health.message || "", missingEnvKeys: health.missingEnvKeys || [],
      requiresKey: requiredEnv.length > 0, lastCheckedAt: health.lastCheckedAt ?? null,
      requests: stats?.requests, errors: stats?.errors, lastError: stats?.lastError ?? sync.lastError ?? null,
      lastSuccessAt: stats?.lastSuccessAt ?? null, rateLimited: stats?.rateLimited,
      lastSuccessfulSyncAt: sync.lastSuccessfulSyncAt, recordsCollected: sync.recordsCollected,
      lastRunResultCount: sync.lastRunResultCount,
    } as ProviderStatus;
  }));
}
