import { NextRequest, NextResponse } from "next/server";
import { GoogleProgrammableSearchProvider } from "@/lib/providers/google";
import { PolygonMarketDataProvider } from "@/lib/market/polygon";

export const dynamic = "force-dynamic";

// "Test Connection" — runs one real health check. Never reveals key values.
export async function POST(req: NextRequest) {
  const { provider } = await req.json().catch(() => ({ provider: "" }));
  if (provider === "GoogleProgrammableSearchProvider") {
    return NextResponse.json(await new GoogleProgrammableSearchProvider().healthCheck());
  }
  if (provider === "MarketDataProvider" || provider === "PolygonMarketDataProvider") {
    return NextResponse.json(await new PolygonMarketDataProvider().healthCheck());
  }
  return NextResponse.json({ connected: false, message: "provider not testable yet" }, { status: 400 });
}
