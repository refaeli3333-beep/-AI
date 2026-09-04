import { MarketDataProvider } from "./types";
import { MockMarketDataProvider } from "./mock";
import { PolygonMarketDataProvider } from "./polygon";
import { YahooFinanceProvider } from "./yahoo";
import { FinnhubProvider } from "./finnhub";
import { AlphaVantageProvider } from "./alphaVantage";
import { getMode } from "../mode";

/**
 * Factory: choose the market-data adapter.
 *
 * DEMO always uses Mock. Outside DEMO the vendor named by MARKET_DATA_PROVIDER is used
 * when its key is present; otherwise it falls back to Yahoo, which is real (keyless)
 * market data — a fallback to REAL data, never to generated numbers. Mock is only ever
 * reached in DEMO mode, and `live` is false only when Mock was actually selected.
 *
 * `live` means "a real vendor was selected". Whether that vendor is reachable right now
 * is decided separately by a real healthCheck at scan time — never by key presence.
 */
export function getMarketProvider(): { provider: MarketDataProvider; live: boolean } {
  if (getMode() === "DEMO") return { provider: new MockMarketDataProvider(), live: false };

  const which = (process.env.MARKET_DATA_PROVIDER || "polygon").toLowerCase();
  if (which === "polygon" && process.env.MARKET_DATA_API_KEY) return { provider: new PolygonMarketDataProvider(), live: true };
  if (which === "finnhub" && process.env.FINNHUB_API_KEY) return { provider: new FinnhubProvider(), live: true };
  if (which === "alphavantage" && process.env.ALPHA_VANTAGE_API_KEY) return { provider: new AlphaVantageProvider(), live: true };

  // No key for the requested vendor — use the keyless real source rather than Mock.
  return { provider: new YahooFinanceProvider(), live: true };
}

export * from "./types";
