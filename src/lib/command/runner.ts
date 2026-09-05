// Executes a parsed ScanCommand end-to-end: picks providers by mode/source, searches
// within the requested people + date range, de-dupes, runs the FULL signal pipeline
// (verify → createSignalIfMeaningful → EconomicImpactInvestigationEngine → prices →
// milestones → $200), reports live progress, and tags every result LIVE / MOCK /
// NOT_AVAILABLE. Nothing is invented; missing providers are reported, not faked.
import { ScanCommand, SCAN_STAGES } from "./nlCommand";
import { AggregatedSearchService } from "../providers/aggregated";
import { MockSearchProvider } from "../providers/mock";
import { connectedSearchProviders } from "../providers/registry";
import { dedupe } from "../search/dedupe";
import { getMode } from "../mode";
import { createSignalIfMeaningful, SignalStore, SignalCreationResult } from "../pipeline/createSignal";
import { getMarketProvider } from "../market";
import { SearchResult } from "../providers/types";
import { aiConfigured, aiHealthCheck } from "../ai/client";

export type SourceTag = "LIVE" | "MOCK" | "NOT_AVAILABLE";

export interface ScanRunResult {
  personName: string; title: string; url: string; domain: string;
  signalId?: string; score?: number; dataCompleteness?: number;
  tags: { news: SourceTag; price: SourceTag; analysis: SourceTag; x: SourceTag };
  companies: { ticker: string; role: string; opportunity: number; risk: number; confidence: number; hidden: boolean }[];
  economicNeed?: string;
  milestones?: { key: string; status: string; changePct?: number; portfolioValue?: number }[];
  impact?: any;  // full EconomicImpact (interpretation, value chain, evidence, suppliers, confidence)
}

export interface ScanRun {
  runId: string; status: "running" | "completed" | "failed";
  progress: number; stage: string; parsed: ScanCommand;
  mode: string; providersUsed: string[]; providerNotes: string[]; missingKeys: string[];
  resultCount: number; signalCount: number; verifiedCount: number; rejectedCount: number;
  results: ScanRunResult[]; errors: string[]; startedAt: string; completedAt?: string;
  blocked?: boolean;            // LIVE mode with missing/unconnected providers
  blockedReason?: string;
}

export interface RunnerDeps {
  loadPeople: (queries: string[]) => Promise<{ full_name: string; aliases?: string[]; official_domains?: string[]; search_languages?: string[]; scan_priority?: string }[]>;
  store: SignalStore;
  now?: Date;
  emit?: (run: ScanRun) => void;              // progress updates
  onComplete?: (run: ScanRun) => Promise<void>; // persist final run + results
}

const RUNS = new Map<string, ScanRun>();
export const getRun = (id: string) => RUNS.get(id) || null;
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `run_${Date.now()}_${Math.random().toString(16).slice(2)}`);

function missingKeysList(): string[] {
  const m: string[] = [];
  if (!process.env.GOOGLE_SEARCH_API_KEY) m.push("GOOGLE_SEARCH_API_KEY");
  if (!process.env.GOOGLE_SEARCH_ENGINE_ID) m.push("GOOGLE_SEARCH_ENGINE_ID");
  if (!process.env.MARKET_DATA_API_KEY) m.push("MARKET_DATA_API_KEY");
  if (!process.env.X_API_BEARER_TOKEN) m.push("X_API_BEARER_TOKEN");
  if (!process.env.TRANSLATION_API_KEY) m.push("TRANSLATION_API_KEY");
  if (!aiConfigured()) m.push("AI_API_KEY");   // ANTHROPIC_API_KEY counts too — same resolution as the AI client
  return m;
}

function newRun(parsed: ScanCommand): ScanRun {
  const mode = getMode();
  return {
    runId: uuid(), status: "running", progress: 0, stage: SCAN_STAGES[0], parsed, mode,
    providersUsed: [], providerNotes: [], missingKeys: missingKeysList(),
    resultCount: 0, signalCount: 0, verifiedCount: 0, rejectedCount: 0,
    results: [], errors: [], startedAt: new Date().toISOString(),
  };
}
function setStage(run: ScanRun, i: number, deps: RunnerDeps) {
  run.stage = SCAN_STAGES[i]; run.progress = Math.round((i / (SCAN_STAGES.length - 1)) * 100); deps.emit?.(run);
}

// Fire-and-forget (POST returns runId; client polls GET for progress).
export function startScanCommand(parsed: ScanCommand, deps: RunnerDeps): ScanRun {
  const run = newRun(parsed);
  RUNS.set(run.runId, run);
  void execute(run, deps).catch((e) => { run.status = "failed"; run.errors.push(String(e?.message || e)); deps.emit?.(run); });
  return run;
}
// Awaitable (used by tests / the e2e script). Returns the completed run.
export async function runScanCommand(parsed: ScanCommand, deps: RunnerDeps): Promise<ScanRun> {
  const run = newRun(parsed);
  RUNS.set(run.runId, run);
  await execute(run, deps);
  return run;
}

async function execute(run: ScanRun, deps: RunnerDeps) {
  const c = run.parsed;
  const mode = run.mode;
  const now = deps.now || new Date();
  setStage(run, 0, deps); // parse

  const hasX = !!process.env.X_API_BEARER_TOKEN;

  // Every provider in the registry that PASSES A REAL HEALTH CHECK right now. This is the
  // only thing that decides LIVE — a configured key that the vendor rejects counts as offline.
  const liveProviders = mode === "DEMO" ? [] : await connectedSearchProviders();
  const newsConnected = liveProviders.length > 0;
  // X passed the same real health check above, or it did not. A present bearer token that
  // the vendor rejects (401/402/429) is NOT a connection.
  const xConnected = liveProviders.some((p) => p.key === "XRecentSearchProvider");

  const providers = mode === "DEMO"
    ? [new MockSearchProvider()]
    : mode === "LIVE"
      ? liveProviders                                        // NO Mock in LIVE, ever
      // HYBRID: real providers first; Mock is added only when nothing real answered,
      // and every result it produces stays tagged MOCK.
      : (newsConnected ? liveProviders : [...liveProviders, new MockSearchProvider()]);
  run.providersUsed = providers.map((p) => p.key);

  let marketConnected = false;
  if (mode !== "DEMO") {
    try { marketConnected = (await getMarketProvider().provider.healthCheck()).connected; } catch { marketConnected = false; }
  }

  // LIVE MUST NOT use Mock/Demo. If nothing real is connected, STOP and report the reason
  // instead of fabricating any data.
  if (mode === "LIVE" && (!newsConnected || !marketConnected)) {
    run.blocked = true;
    run.blockedReason = "מצב LIVE דורש ספק חדשות מחובר ונתוני שוק מחוברים. אף ספק לא עבר בדיקת חיבור אמיתית — הסריקה נעצרה ולא הוצגו נתונים מדומים.";
    run.providerNotes.push(run.blockedReason);
    run.status = "completed"; run.progress = 100; run.completedAt = new Date().toISOString();
    deps.emit?.(run); if (deps.onComplete) await deps.onComplete(run);
    return;
  }

  if (c.sourceTypes.includes("x_posts") && !xConnected)
    run.providerNotes.push(hasX
      ? "X API מוגדר אך בדיקת החיבור נכשלה (הבקשה נדחתה על ידי X) — ציוצים אינם זמינים לאימות ישיר; נעשה שימוש במקורות משניים / Mock."
      : "X API אינו מחובר (X_API_BEARER_TOKEN חסר) — ציוצים אינם זמינים לאימות ישיר; נעשה שימוש במקורות משניים / Mock.");
  if (!newsConnected && mode === "HYBRID") run.providerNotes.push("אף ספק חדשות לא עבר בדיקת חיבור — נעשה שימוש ב-Mock (מסומן) עד לחיבור אמיתי.");
  else if (mode !== "DEMO") run.providerNotes.push(`ספקים מחוברים בפועל: ${liveProviders.map((p) => p.key).join(", ")}`);
  const search = new AggregatedSearchService(providers);

  // LIVE only on a successful request; otherwise MOCK (fallback, marked) or NOT_AVAILABLE (no fallback).
  const newsTag: SourceTag = newsConnected ? "LIVE" : "MOCK";
  const priceTag: SourceTag = marketConnected ? "LIVE" : "MOCK";
  // Without a reachable AI layer the pipeline falls back to the deterministic keyword
  // analysis — that is real code, not invented output, so it is labelled MOCK not LIVE.
  // A configured AI_API_KEY is NOT proof the model answers: billing, quota and refusals
  // all leave it unreachable, so probe it once per run exactly as the market provider is
  // probed above. Tagging analysis LIVE on key presence alone reported the heuristic as
  // real model output.
  let aiConnected = false;
  if (mode !== "DEMO" && aiConfigured()) {
    try { aiConnected = (await aiHealthCheck()).state === "LIVE"; } catch { aiConnected = false; }
  }
  const analysisTag: SourceTag = aiConnected ? "LIVE" : "MOCK";
  // X has no fallback source, so "not connected" is NOT_AVAILABLE rather than MOCK.
  const xTag: SourceTag = xConnected ? "LIVE" : "NOT_AVAILABLE";

  setStage(run, 1, deps); // search
  const people = await deps.loadPeople(c.peopleQuery);
  const targets = people.length ? people : [{ full_name: "", aliases: [], scan_priority: "medium" }];

  const seenU = new Set<string>(); const seenH = new Set<string>();
  const collected: SearchResult[] = [];
  for (const person of targets) {
    const base = person.full_name ? `"${person.full_name}"` : "";
    const topicPart = c.topics.length ? ` ${c.topics.join(" OR ")}` : "";
    const q = `${base}${topicPart}`.trim() || "market moving statement";
    try {
      const freshnessHours = Math.max(1, Math.round((Date.now() - new Date(c.dateRange.from).getTime()) / 3.6e6));
      collected.push(...await search.search(q, { freshnessHours, maxResults: 5 }));
    } catch (e) { run.errors.push(String((e as any)?.message || e)); }
  }

  setStage(run, 2, deps); // dedupe
  const fresh = dedupe(collected, seenU, seenH);
  run.resultCount = fresh.length;

  setStage(run, 3, deps); // reliability (inside pipeline)
  setStage(run, 4, deps); // analyse
  for (const r of fresh) {
    let created: SignalCreationResult;
    try {
      created = await createSignalIfMeaningful({ result: r, personName: c.people[0] || "", now }, deps.store);
    } catch (e) { run.errors.push(String((e as any)?.message || e)); run.rejectedCount++; continue; }

    if (!created.created) { run.rejectedCount++; continue; }
    run.signalCount++;
    if (created.sources?.news === "LIVE") run.verifiedCount++;

    const companies = (created.impact?.companies || []).map((co) => ({
      ticker: co.ticker, role: co.roleInValueChain, opportunity: co.opportunityScore,
      risk: co.riskScore, confidence: co.confidenceScore,
      hidden: ["component_supplier", "equipment_manufacturer", "infrastructure_provider"].includes(co.roleInValueChain),
    }));
    run.results.push({
      personName: c.people[0] || r.title, title: r.title, url: r.url, domain: r.domain,
      signalId: created.signalId, score: created.score, dataCompleteness: created.dataCompleteness,
      // The pipeline already decided per signal whether news, price and analysis were real.
      // That verdict wins; the run-level tag is only a fallback when it is absent.
      tags: {
        news: created.sources?.news ?? newsTag,
        price: created.sources?.price ?? priceTag,
        analysis: created.sources?.analysis ?? analysisTag,
        x: xTag,
      },
      companies, economicNeed: created.impact?.economicNeed, impact: created.impact,
      milestones: (created as any).milestones, // milestones are persisted via the store; summary optional
    });
  }
  setStage(run, 6, deps); setStage(run, 7, deps); setStage(run, 8, deps);
  setStage(run, 9, deps);
  run.status = "completed"; run.progress = 100; run.completedAt = new Date().toISOString();
  deps.emit?.(run);
  if (deps.onComplete) await deps.onComplete(run);
}
