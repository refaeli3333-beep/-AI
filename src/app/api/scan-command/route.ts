import { NextRequest, NextResponse } from "next/server";
import { parseScanCommand } from "@/lib/command/nlCommand";
import { startScanCommand, ScanRun, RunnerDeps } from "@/lib/command/runner";
import { getServiceClient } from "@/lib/db";
import { SignalStore } from "@/lib/pipeline/createSignal";
import { Milestone } from "@/lib/market/types";

export const dynamic = "force-dynamic";

// Real Supabase-backed store (falls back to in-memory when DB is not configured).
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
        if (impactId) for (const e of c.evidence) await db.from("impact_evidence").insert({
          event_company_impact_id: impactId, source_url: e.sourceUrl, source_type: e.sourceType,
          extracted_fact: e.extractedFact, reliability_score: e.reliabilityScore, relevance_score: e.relevanceScore,
        });
      }
    },
  };
}

// POST /api/scan-command  { command, tzOffsetMin? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const command = String(body.command || "").trim();
  if (!command) return NextResponse.json({ error: "command required" }, { status: 400 });
  const tz = Number(body.tzOffsetMin || 0);

  const parsed = parseScanCommand(command, new Date(), tz);
  const db = getServiceClient();
  const store = makeStore(db);

  const deps: RunnerDeps = {
    store,
    loadPeople: async (queries) => {
      if (!db || !queries.length) return [];
      // alias-aware: match each fragment against full_name, original-language name and aliases
      const ors: string[] = [];
      for (const q of queries) {
        ors.push(`full_name.ilike.%${q}%`);
        ors.push(`name_in_original_language.ilike.%${q}%`);
        ors.push(`aliases.cs.{${q}}`);
      }
      const { data } = await db.from("influential_people")
        .select("full_name,aliases,name_in_original_language,official_domains,search_languages,scan_priority")
        .or(ors.join(","));
      return data || [];
    },
    onComplete: async (run: ScanRun) => {
      if (!db) return;
      await db.from("scan_commands").update({
        status: run.status, progress: run.progress, current_stage: run.stage,
        providers_used: run.providersUsed, result_count: run.resultCount,
        signal_count: run.signalCount, error_count: run.errors.length, completed_at: run.completedAt,
      }).eq("id", run.runId);
      for (const [i, o] of run.results.entries()) {
        await db.from("scan_command_results").insert({
          scan_command_id: run.runId, signal_id: o.signalId || null, rank: i + 1, relevance_score: o.score || null, included: true,
        });
      }
    },
  };

  const run = startScanCommand(parsed, deps);

  // create the scan_run row immediately (status=running); onComplete updates it.
  if (db) await db.from("scan_commands").insert({
    id: run.runId, command_text: command, parsed_command_json: parsed,
    status: "running", providers_used: run.providersUsed, started_at: run.startedAt,
  });

  return NextResponse.json({
    parsedCommand: parsed, runId: run.runId, status: run.status,
    mode: run.mode, missingKeys: run.missingKeys, providerNotes: run.providerNotes,
  });
}
