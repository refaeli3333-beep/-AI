import { MarketDataProvider } from "./types";
import { MockMarketDataProvider } from "./mock";
import { PolygonMarketDataProvider } from "./polygon";
import { getMode } from "../mode";

// Factory: real provider when a key exists AND mode is not DEMO; otherwise Mock.
// Returns which source it is so records can be tagged LIVE / MOCK.
export function getMarketProvider(): { provider: MarketDataProvider; live: boolean } {
  const mode = getMode();
  const hasKey = !!process.env.MARKET_DATA_API_KEY;
  const which = (process.env.MARKET_DATA_PROVIDER || "polygon").toLowerCase();
  if (mode !== "DEMO" && hasKey) {
    const provider = which === "polygon" ? new PolygonMarketDataProvider() : new PolygonMarketDataProvider();
    return { provider, live: true };
  }
  return { provider: new MockMarketDataProvider(), live: false };
}

export * from "./types";
