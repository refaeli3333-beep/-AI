// Market data behind a swappable adapter. One provider is chosen via env; the rest
// of the system depends only on this interface, never on a specific vendor.
export type MarketSession = "regular" | "pre" | "post" | "closed";

export interface Candle {
  provider: string; symbol: string; tsUtc: string;
  open: number; high: number; low: number; close: number;
  volume: number; marketSession: MarketSession;
}

export interface PriceAt {
  provider: string; symbol: string; tsUtc: string; price: number;
  marketSession: MarketSession;
  usedFallback: boolean;          // true when publication fell outside regular hours
  lastCloseBefore?: number;       // last regular-session close before the timestamp
  nextOpen?: number;              // next regular-session open after the timestamp
}

export interface Milestone {
  key: string; label: string; dueAt: string;
  status: "filled" | "pending";   // never fill a point before it has occurred
  price?: number; changePct?: number; portfolioValue?: number; volume?: number;
}

export interface MarketHealth { key: string; connected: boolean; missingEnvKeys: string[]; message: string; }

export interface MarketDataProvider {
  readonly key: string;
  getLatestPrice(symbol: string): Promise<PriceAt | null>;
  getPriceAtTimestamp(symbol: string, tsUtc: string): Promise<PriceAt | null>;
  getCandlesBetween(symbol: string, fromUtc: string, toUtc: string, interval: "1m" | "5m" | "1d"): Promise<Candle[]>;
  getMarketSession(tsUtc: string): MarketSession;
  getPriceMilestones(symbol: string, publishedAtUtc: string, amount: number, now?: Date): Promise<Milestone[]>;
  healthCheck(): Promise<MarketHealth>;
}

// US-equity regular session ≈ 13:30–20:00 UTC (09:30–16:00 ET). Weekends closed.
// Pre 08:00–13:30 UTC, post 20:00–24:00 UTC. (DST is approximated.)
export function usMarketSession(tsUtc: string): MarketSession {
  const d = new Date(tsUtc);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return "closed";
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (mins >= 810 && mins < 1200) return "regular"; // 13:30–20:00
  if (mins >= 480 && mins < 810) return "pre";      // 08:00–13:30
  if (mins >= 1200 && mins < 1440) return "post";   // 20:00–24:00
  return "closed";
}

export const MILESTONE_DEFS: { key: string; label: string; mins: number }[] = [
  { key: "signal", label: "בזמן הפרסום", mins: 0 },
  { key: "h1", label: "אחרי שעה", mins: 60 },
  { key: "h3", label: "אחרי 3 שעות", mins: 180 },
  { key: "d1", label: "אחרי 24 שעות", mins: 1440 },
  { key: "d3", label: "אחרי 3 ימים", mins: 4320 },
  { key: "d7", label: "אחרי 7 ימים", mins: 10080 },
  { key: "d30", label: "אחרי 30 ימים", mins: 43200 },
];
