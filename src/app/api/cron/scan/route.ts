import { NextRequest, NextResponse } from "next/server";
import { scanInfluentialPeople, ScanDeps } from "@/lib/jobs/scanInfluentialPeople";
import { getServiceClient } from "@/lib/db";
import { createSignalIfMeaningful, SignalStore } from "@/lib/pipeline/createSignal";
import { Milestone } from "@/lib/market/types";

export const dynamic = "force-dynamic";

// Supabase-backed store for the pipeline. Falls back to in-memory no-ops if DB is absent.
function makeStore(db: ReturnType<typeof getServiceClient>): SignalStore {
  const seen = new Set<string>();
  return {
    isDuplicateSignal: async (hash) => {
      if (seen.has(hash)) return true;
      if (!db) { seen.add(hash); return false; }
      const { data } = await db.from("signals").select("id").eq("content_hash", hash).limit(1);
      const dup = !!(data && data.length); if (!dup) seen.add(hash); return dup;
    },
    saveSignal: async (row) => { if (db) { const { data } = await db.from("signals").insert(row).select("id").single(); return data?.id || row.id; } return row.id; },
    saveSignalAsset: async (row) => { if (db) await db.from("signal_assets").insert(row); },
    saveMilestone: async (signalId, m: Milestone) => {
      if (db) await db.from("price_snapshots").insert({
        signal_id: signalId, snapshot_type: m.key, price: m.price ?? null,
        portfolio_value: m.portfolioValue ?? null, profit_loss_percent: m.changePct ?? null,
        recorded_at: m.status === "filled" ? m.dueAt : null,
      });
    },
    emitAlert: async (msg) => { if (db) await db.from("alerts").insert({ title: "אות חזק", message: msg, severity: "high" }); },
    saveImpact: async (signalId, impact) => {
      if (!db) return;
      await db.from("event_needs").insert({ signal_id: signalId, need_type: "economic", description: impact.economicNeed, importance_score: impact.confidenceScore });
      for (const c of impact.companies) {
        const { data } = await db.from("event_company_impacts").insert({
          signal_id: signalId, ticker: c.ticker, impact_type: c.roleInValueChain,
          directness_score: c.directnessScore, opportunity_score: c.opportunityScore, risk_score: c.riskScore,
          already_priced_in_score: c.alreadyPricedInScore, revenue_mechanism: c.revenueMechanism,
          expected_time_to_revenue: c.expectedTimeToRevenue, explanation: c.explanation, confidence_score: c.confidenceScore,
        }).select("id").single();
        const impactId = data?.id;
        if (impactId) for (const e of c.evidence) {
          await db.from("impact_evidence").insert({
            event_company_impact_id: impactId, source_url: e.sourceUrl, source_type: e.sourceType,
            extracted_fact: e.extractedFact, reliability_score: e.reliabilityScore, relevance_score: e.relevanceScore,
          });
        }
      }
    },
  };
}

export async function GET(req: NextRequest) {
  // Fail closed. This endpoint spends provider quota and writes to Supabase, so an
  // unset or empty CRON_SECRET must refuse the request rather than run it for anyone:
  // `if (secret && ...)` silently skipped the check whenever the variable was empty,
  // which is how it was reachable unauthenticated in production.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({
      error: "cron_not_configured",
      message: "CRON_SECRET אינו מוגדר (או ריק) — נקודת הקצה מסרבת לפעול כדי לא להיות פתוחה לכל דורש. יש להגדיר CRON_SECRET בהגדרות הפרויקט ב-Vercel.",
    }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || req.nextUrl.searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const store = makeStore(db);

  const deps: ScanDeps = {
    loadActivePeople: async () => {
      if (!db) return [];
      const { data } = await db.from("influential_people")
        .select("full_name,aliases,name_in_original_language,company,current_role,official_domains,search_languages,scan_priority")
        .eq("is_active", true).eq("active_scan", true).order("importance_score", { ascending: false });
      return data || [];
    },
    isKnownUrl: async (url) => {
      if (!db) return false;
      const { data } = await db.from("search_results").select("id").eq("url", url).limit(1);
      return !!(data && data.length);
    },
    isKnownHash: async (hash) => {
      if (!db) return false;
      const { data } = await db.from("search_results").select("id").eq("content_hash", hash).limit(1);
      return !!(data && data.length);
    },
    saveResult: async (r) => {
      if (!db) return;
      await db.from("search_results").upsert(
        { url: r.url, domain: r.domain, title: r.title, snippet: r.snippet, provider: r.provider,
          query_text: r.query, published_at: r.publishedAt, source_score: r.sourceScore, processing_status: "pending" },
        { onConflict: "url", ignoreDuplicates: true });
    },
    // NOW CONNECTED: runs the full investigation pipeline for real.
    createSignalIfMeaningful: async (r, personName) => {
      const res = await createSignalIfMeaningful({ result: r, personName }, store);
      return { created: res.created, score: res.score };
    },
    emitAlert: async (msg) => { await store.emitAlert(msg); },
  };

  const report = await scanInfluentialPeople(deps);
  return NextResponse.json(report);
}
