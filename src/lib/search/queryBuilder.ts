// Build smart, budgeted search queries per person. Names are never hard-coded —
// they come from the influential_people row (name + aliases + keywords).
export type Priority = "high" | "medium" | "low";

export interface PersonForQuery {
  full_name: string;
  aliases?: string[];
  name_in_original_language?: string | null;
  company?: string | null;
  current_role?: string | null;
  official_domains?: string[];
  search_languages?: string[];
  scan_priority?: Priority;
}

const FRESH = ["latest statement", "announcement", "interview", "speech", "said", "today", "breaking"];
const FINANCIAL = ["investment", "contract", "sanctions", "tariffs", "artificial intelligence",
  "chips", "defense", "energy", "crypto", "regulation"];
const HE_FINANCIAL = ["הודיע", "אמר", "השקעה", "ביטחון", "טכנולוגיה", "רגולציה"];

// Queries-per-scan budget by priority (protects the Google daily quota).
export const QUERY_BUDGET: Record<Priority, number> = { high: 5, medium: 2, low: 1 };

export function buildQueries(p: PersonForQuery): { text: string; kind: string; language: string }[] {
  const name = `"${p.full_name}"`;
  const aliasNames = (p.aliases || []).map((a) => `"${a}"`);
  const budget = QUERY_BUDGET[p.scan_priority || "medium"];
  const out: { text: string; kind: string; language: string }[] = [];

  // 1) fresh publications (English)
  FRESH.slice(0, 3).forEach((s) => out.push({ text: `${name} ${s}`, kind: "fresh", language: "en" }));
  // 2) financial angle
  FINANCIAL.slice(0, 3).forEach((s) => out.push({ text: `${name} ${s}`, kind: "financial", language: "en" }));
  // 3) official sources
  (p.official_domains || []).slice(0, 2).forEach((d) =>
    out.push({ text: `site:${d} ${name}`, kind: "official", language: "en" }));
  out.push({ text: `site:gov ${name}`, kind: "official", language: "en" });
  // 4) local language
  const hasHe = (p.search_languages || []).includes("he") || !!p.name_in_original_language;
  if (hasHe) {
    const heName = `"${p.name_in_original_language || p.full_name}"`;
    HE_FINANCIAL.slice(0, 2).forEach((s) => out.push({ text: `${heName} ${s}`, kind: "language", language: "he" }));
  }
  // alias variants (helps recall)
  aliasNames.slice(0, 2).forEach((a) => out.push({ text: `${a} announcement`, kind: "fresh", language: "en" }));

  // apply query budget, prioritising fresh > financial > official > language
  const order = ["fresh", "financial", "official", "language"];
  out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return dedupeQueries(out).slice(0, budget);
}

function dedupeQueries(qs: { text: string; kind: string; language: string }[]) {
  const seen = new Set<string>();
  return qs.filter((q) => { const k = q.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
