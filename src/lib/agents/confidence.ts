/**
 * Confidence model for an investigation.
 *
 * THE RULE: the number of agents is NOT an input. Twenty agents agreeing on one blog
 * post is weaker than two agents agreeing on an SEC filing, so `computeConfidence`
 * physically cannot see an agent count — it only receives evidence facts. Agreement
 * is reported separately (see consensus.ts) and never converted into confidence.
 */

export interface ConfidenceInput {
  /** Distinct source domains behind the claim. One domain = one source, however many articles. */
  independentSources: number;
  /** 0..100 — mean reliability of those sources (official/filings high, aggregators low). */
  sourceQuality: number;
  /** 0..1 — observed success rate of the providers that produced the evidence. */
  providerReliability: number;
  /** 0..1 — share of evidence items that were actually opened and verified, not just listed. */
  verifiedShare: number;
  /** Direct contradictions found between sources or agents. */
  contradictions: number;
  /** Questions the room could not answer with evidence. */
  unresolvedQuestions: number;
  /** 0..1 historical hit-rate for this kind of prediction; null when there is no track record yet. */
  historicalAccuracy: number | null;
}

export interface ConfidenceBreakdown {
  score: number;                    // 0..100
  components: Record<string, number>;
  caps: string[];                   // ceilings that were applied, in plain language
  notes: string[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function computeConfidence(i: ConfidenceInput): ConfidenceBreakdown {
  const components: Record<string, number> = {
    // Independent corroboration: strong but saturating — the 4th source adds little.
    independentEvidence: Math.min(35, i.independentSources * 12),
    sourceQuality: (clamp(i.sourceQuality) / 100) * 25,
    providerReliability: clamp(i.providerReliability, 0, 1) * 15,
    verification: clamp(i.verifiedShare, 0, 1) * 15,
    // No track record is neutral (0), not a bonus.
    historicalAccuracy: i.historicalAccuracy === null ? 0 : (clamp(i.historicalAccuracy, 0, 1) - 0.5) * 20,
    contradictionPenalty: -Math.min(30, i.contradictions * 12),
    unresolvedPenalty: -Math.min(10, i.unresolvedQuestions * 5),
  };

  let score = clamp(Object.values(components).reduce((a, b) => a + b, 0));

  const caps: string[] = [];
  if (i.independentSources < 2) { score = Math.min(score, 40); caps.push("מקור יחיד — תקרת ביטחון 40"); }
  if (i.verifiedShare <= 0) { score = Math.min(score, 55); caps.push("לא בוצע אימות ראיות בפועל — תקרה 55"); }
  if (i.contradictions > 0 && i.contradictions >= i.independentSources) {
    score = Math.min(score, 35);
    caps.push("מספר הסתירות שווה או עולה על מספר המקורות — תקרה 35");
  }

  const notes = ["מספר הסוכנים אינו משפיע על הביטחון — רק ראיות, איכות מקור, אמינות ספק, סתירות, אימות ודיוק היסטורי."];
  if (i.historicalAccuracy === null) notes.push("אין עדיין היסטוריית דיוק לתחום הזה — הרכיב מנוטרל.");

  return { score: Math.round(clamp(score)), components, caps, notes };
}

/** Distinct domains — the only thing that counts as an independent source. */
export function countIndependentSources(urls: string[]): number {
  const domains = new Set<string>();
  for (const u of urls) {
    try { domains.add(new URL(u).hostname.replace(/^www\./, "")); } catch { /* unparseable URL is not a source */ }
  }
  return domains.size;
}
