import { SearchResult } from "../providers/types";
import { fetchSource, FetchedSource } from "../source/fetchSource";
import { translateToHebrew } from "../translate/translate";
import { analyzeStatement, Analysis } from "../analysis/aiAnalysis";
import { mapAssets } from "../data/assets";
import { scoreCandidate, SignalLite } from "../analysis/investigate";
import { getMarketProvider } from "../market";
import { Milestone } from "../market/types";
import { scoreSource } from "../search/sourceScore";
import { dataCompleteness } from "./completeness";
import { getMode } from "../mode";
import { EconomicImpactInvestigationEngine, EconomicImpact } from "../impact/engine";

export interface SignalCreationResult {
  created: boolean;
  signalId?: string;
  rejectionReason?: string;
  evidenceCount: number;
  mappedAssets: number;
  confidenceScore: number;
  score?: number;
  dataCompleteness?: number;
  sources?: { news: "LIVE" | "MOCK"; price: "LIVE" | "MOCK"; analysis: "LIVE" | "MOCK" };
  impact?: EconomicImpact;
}

// Injected persistence so this runs both against Supabase (route) and in-memory (tests).
export interface SignalStore {
  isDuplicateSignal(contentHash: string): Promise<boolean>;
  saveSignal(row: any): Promise<string>;                 // returns signalId
  saveSignalAsset(row: any): Promise<void>;
  saveMilestone(signalId: string, m: Milestone): Promise<void>;
  emitAlert(msg: string): Promise<void>;
  saveImpact?(signalId: string, impact: EconomicImpact): Promise<void>;
}

export interface SignalInput {
  result: SearchResult;
  personName: string;
  personId?: string;
  // allow tests to inject deterministic collaborators
  now?: Date;
  _fetchSource?: typeof fetchSource;
  _source?: FetchedSource;
}

const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `sig_${Date.now()}_${Math.random().toString(16).slice(2)}`);

/**
 * Full pipeline: search result → fetch source → extract → verify → detect quote →
 * translate → AI investigation → map sectors/companies/tickers → price at publication →
 * score → risk → create signal → schedule future milestones → alert.
 * Creates a signal ONLY when at least one asset has sufficient evidence.
 */
export async function createSignalIfMeaningful(input: SignalInput, store: SignalStore): Promise<SignalCreationResult> {
  const now = input.now || new Date();
  const mode = getMode();
  const src = input._source || await (input._fetchSource || fetchSource)(input.result.url);

  // --- verify source & pick the best available text ---
  const sourceScore = scoreSource(input.result.domain).score;
  const blocked = src.fetchStatus !== "ok";
  const text = (!blocked && src.extractedText) ? src.extractedText : input.result.snippet;
  const directQuote = src.directQuotes[0] || null;

  // exact publication time: prefer the opened source, else the search result; may be null
  const publishedAt = src.publishedAt || input.result.publishedAt || null;

  // --- translate + analyse ---
  const translation = await translateToHebrew(text, src.language);
  const analysis: Analysis = await analyzeStatement(text);

  // --- map sectors → companies → tickers ---
  const mapped = mapAssets(analysis.sectors);
  if (analysis.sectors.length === 0 || mapped.length === 0) {
    return { created: false, rejectionReason: "לא נמצאה משמעות אפשרית לשוק (לא זוהה סקטור/חברה)", evidenceCount: 0, mappedAssets: 0, confidenceScore: 0 };
  }

  // --- market data at publication time (per candidate, top 5) ---
  const { provider: market, live: priceLive } = getMarketProvider();
  const sig: SignalLite = {
    id: Math.floor(Math.random() * 1e6),
    sectors: analysis.sectors,
    directness: analysis.live ? 0.85 : 0.7,
    confirmations: sourceScore >= 90 ? 2 : sourceScore >= 70 ? 1 : 0,
    verif: sourceScore >= 90 ? "verified" : sourceScore >= 70 ? "partial" : blocked ? "unverified" : "needs_review",
    stage: analysis.eventStage,
    preMove: false,
    primaryAssetId: mapped[0].asset.id,
  };

  const top = mapped.slice(0, 5);
  const scoredAssets: { m: typeof top[number]; changeH1: number; priceAtSignal: number; scored: ReturnType<typeof scoreCandidate> }[] = [];
  for (const cand of top) {
    let changeH1 = 0, priceAtSignal = cand.asset.entry;
    if (publishedAt) {
      const pa = await market.getPriceAtTimestamp(cand.asset.symbol, publishedAt);
      if (pa) priceAtSignal = pa.price;
      const h1Due = new Date(new Date(publishedAt).getTime() + 60 * 60000);
      if (h1Due <= now) {
        const h1 = await market.getPriceAtTimestamp(cand.asset.symbol, h1Due.toISOString());
        if (h1 && priceAtSignal) changeH1 = (h1.price - priceAtSignal) / priceAtSignal * 100;
      }
    }
    scoredAssets.push({ m: cand, changeH1, priceAtSignal, scored: scoreCandidate(sig, cand.asset, cand.role, changeH1) });
  }
  scoredAssets.sort((a, b) => b.scored.opportunityScore - a.scored.opportunityScore);

  // --- evidence gate: need at least one asset with sufficient evidence ---
  const best = scoredAssets[0];
  const evidenceCount = (directQuote ? 1 : 0) + (sourceScore >= 80 ? 1 : 0) + scoredAssets.length;
  const sufficient = best && best.scored.directnessScore >= 45 && evidenceCount >= 2;
  if (!sufficient) {
    return { created: false, rejectionReason: "לא נמצא קשר מספיק חזק למניה מסוימת (ראיות חלשות)", evidenceCount, mappedAssets: scoredAssets.length, confidenceScore: best?.scored.confidenceScore || 0 };
  }

  // --- de-duplicate against existing signals ---
  if (await store.isDuplicateSignal(src.contentHash || input.result.url)) {
    return { created: false, rejectionReason: "אות כפול — כבר קיים במערכת", evidenceCount, mappedAssets: scoredAssets.length, confidenceScore: best.scored.confidenceScore };
  }

  // --- data completeness & source tags (never present demo as live) ---
  const newsLive = mode !== "DEMO" && input.result.provider !== "MockSearchProvider" && !blocked;
  const completeness = dataCompleteness({
    liveNews: newsLive, fullText: !blocked, exactTime: !!publishedAt,
    livePrice: priceLive && !!publishedAt, liveAnalysis: analysis.live,
  });
  const sources = {
    news: (newsLive ? "LIVE" : "MOCK") as "LIVE" | "MOCK",
    price: (priceLive ? "LIVE" : "MOCK") as "LIVE" | "MOCK",
    analysis: (analysis.live ? "LIVE" : "MOCK") as "LIVE" | "MOCK",
  };

  // --- create the signal ---
  const signalId = await store.saveSignal({
    id: uuid(),
    person_id: input.personId || null,
    original_text: text,
    translated_text: translation.text,
    simple_summary: analysis.meaning,
    direct_quote: directQuote,                       // null when no direct quote found
    source_url: src.canonicalUrl || input.result.url,
    source_type: input.result.provider,
    published_at: publishedAt,                        // null if unknown — not invented
    topic: analysis.topic,
    event_type: analysis.eventType,
    event_stage: analysis.eventStage,
    confidence_score: best.scored.confidenceScore,
    risk_level: best.scored.riskScore > 66 ? "גבוה" : best.scored.riskScore > 40 ? "בינוני" : "נמוך",
    verification_status: sig.verif,
    connection_tag: best.scored.directnessScore >= 80 ? "direct" : best.scored.directnessScore >= 62 ? "indirect" : "weak",
    content_hash: src.contentHash || input.result.url,
    news_source: sources.news, price_source: sources.price, analysis_source: sources.analysis,
    data_completeness: completeness.percent,
    is_demo: mode === "DEMO",
  });

  // --- signal_assets (top 5, with all scores) ---
  for (const sa of scoredAssets) {
    await store.saveSignalAsset({
      signal_id: signalId, symbol: sa.m.asset.symbol, company_name: sa.m.asset.name,
      connection_reason: `${sa.m.asset.name} (${sa.m.role}) בתחום ${sa.m.asset.sub || sa.m.asset.sector}`,
      role_in_chain: sa.m.role,
      directness_score: sa.scored.directnessScore,
      evidence_score: sourceScore,
      market_reaction_score: sa.scored.marketReactionScore,
      already_priced_in_score: sa.scored.alreadyPricedInScore,
      opportunity_score: sa.scored.opportunityScore,
      risk_score: sa.scored.riskScore,
      confidence_score: sa.scored.confidenceScore,
      price_at_signal: sa.priceAtSignal,
    });
  }

  // --- deep economic-impact investigation (need → tech → components → companies) ---
  const priceChange: Record<string, { changeH1Pct: number; changeNowPct: number; reacted: boolean }> = {};
  for (const sa of scoredAssets) {
    priceChange[sa.m.asset.symbol] = { changeH1Pct: sa.changeH1, changeNowPct: sa.changeH1, reacted: Math.abs(sa.changeH1) >= 1 };
  }
  const impact = new EconomicImpactInvestigationEngine().investigate({
    text, personName: input.personName, publishedAt, sourceType: input.result.provider,
    sectors: analysis.sectors, eventStage: analysis.eventStage, priceChange,
    sourceEvidence: { url: src.canonicalUrl || input.result.url, type: input.result.provider, title: src.title, publishedAt },
  });
  if (store.saveImpact) await store.saveImpact(signalId, impact);

  // --- schedule future price milestones (Pending until they occur) ---
  if (publishedAt) {
    const milestones = await market.getPriceMilestones(best.m.asset.symbol, publishedAt, 200, now);
    for (const ms of milestones) await store.saveMilestone(signalId, ms);
  }

  // --- alert on strong signals ---
  const finalScore = best.scored.opportunityScore;
  if (finalScore >= 80) await store.emitAlert(`אות חזק (${finalScore}) עבור ${input.personName} · ${best.m.asset.symbol}`);

  return {
    created: true, signalId, evidenceCount, mappedAssets: scoredAssets.length,
    confidenceScore: best.scored.confidenceScore, score: finalScore,
    dataCompleteness: completeness.percent, sources, impact,
  };
}
