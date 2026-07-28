// Internal knowledge graph over the curated KB. Supports multi-hop traversal:
// sector → technology → component → company → (supply edges) → company.
import { TECHNOLOGIES, COMPONENTS, CAPABILITIES, COMPANY_EDGES, SECTOR_TECH_CHAIN, Technology, Component, Capability, CompanyEdge } from "./knowledgeBase";

export function techsForSectors(sectors: string[]): Technology[] {
  const ids = new Set<string>();
  sectors.forEach((s) => (SECTOR_TECH_CHAIN[s] || []).forEach((t) => ids.add(t)));
  return TECHNOLOGIES.filter((t) => ids.has(t.id));
}
export function componentsForTechs(techIds: string[]): Component[] {
  const set = new Set(techIds);
  return COMPONENTS.filter((c) => set.has(c.technologyId));
}
export function capabilitiesForTechs(techIds: string[]): Capability[] {
  const set = new Set(techIds);
  return CAPABILITIES.filter((c) => c.technologyId && set.has(c.technologyId));
}
export function edgesFor(ticker: string): CompanyEdge[] {
  return COMPANY_EDGES.filter((e) => e.source === ticker || e.target === ticker);
}

// Multi-hop traversal starting from a set of technologies. Returns companies with the
// hop distance (0 = direct capability, 1 = one supply edge away, ...).
export function traverse(techIds: string[], maxHops = 2): { ticker: string; hop: number; via: string }[] {
  const out = new Map<string, { ticker: string; hop: number; via: string }>();
  const direct = capabilitiesForTechs(techIds);
  direct.forEach((c) => { if (!out.has(c.companyTicker)) out.set(c.companyTicker, { ticker: c.companyTicker, hop: 0, via: c.technologyId || "" }); });

  let frontier = Array.from(out.keys());
  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    for (const ticker of frontier) {
      for (const e of edgesFor(ticker)) {
        const other = e.source === ticker ? e.target : e.source;
        if (e.type === "COMPETES_WITH") continue; // competitors handled separately
        if (!out.has(other)) { out.set(other, { ticker: other, hop, via: e.type }); next.push(other); }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return Array.from(out.values());
}

// Competitors / substitutes of a set of beneficiaries (possible losers when the event
// favours the beneficiary, or beneficiaries when the event hurts them — caller decides).
export function competitorsOf(tickers: string[]): { ticker: string; of: string; evidenceUrl: string }[] {
  const set = new Set(tickers); const out: { ticker: string; of: string; evidenceUrl: string }[] = [];
  for (const e of COMPANY_EDGES) {
    if (e.type !== "COMPETES_WITH") continue;
    if (set.has(e.source) && !set.has(e.target)) out.push({ ticker: e.target, of: e.source, evidenceUrl: e.evidenceUrl });
    if (set.has(e.target) && !set.has(e.source)) out.push({ ticker: e.source, of: e.target, evidenceUrl: e.evidenceUrl });
  }
  return out;
}
