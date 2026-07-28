// Deep-investigation engine: from a statement to a ranked supply chain of assets.
// Ported from the demo; pure and deterministic so it can be unit-tested.
export interface AssetLite {
  id: number; symbol: string; name: string; sector: string; sub?: string;
  entry: number; current: number; vol: number; marketCap: number; type: "stock" | "crypto";
}
export interface SignalLite {
  id: number; sectors: string[]; directness: number; confirmations: number;
  verif: "verified" | "partial" | "needs_review" | "rumor" | "unverified"; stage: string; preMove: boolean;
  primaryAssetId: number;
}

const STAGE_CONF: Record<string, number> = {
  hint: 20, opinion: 25, statement: 40, intent: 45, plan: 55, bill: 60,
  gov_approval: 75, budget_approval: 80, tender: 78, signed_contract: 92, production: 90, delivery: 95, revenue: 98,
};
const ROLE_DIRECT: Record<string, number> = {
  direct_beneficiary: 1, supplier: 0.78, component: 0.7, infrastructure: 0.6, indirect: 0.5, same_sector: 0.72, competitor: 0.42, related: 0.55,
};

export interface CandidateScore {
  asset: AssetLite; role: string;
  directnessScore: number; opportunityScore: number; riskScore: number; confidenceScore: number;
  alreadyPricedInScore: number; marketReactionScore: number;
}

export function scoreCandidate(sig: SignalLite, asset: AssetLite, role: string, changeH1Pct: number): CandidateScore {
  const alreadyMoved = Math.abs(changeH1Pct) / 100;
  const directness = (ROLE_DIRECT[role] ?? 0.55) * (0.6 + 0.4 * sig.directness);
  const cap = asset.marketCap || 60;
  const significance = Math.min(1, (8 / Math.sqrt(cap)) * ((STAGE_CONF[sig.stage] ?? 40) / 100));
  const verifBonus = sig.verif === "verified" ? 8 : sig.verif === "partial" ? 4 : 0;
  const hiddenBonus = ["supplier", "component", "infrastructure", "indirect"].includes(role) ? 6 : 0;
  let opportunity = directness * 38 + significance * 22 + verifBonus + hiddenBonus;
  opportunity += alreadyMoved < 0.02 ? 18 : alreadyMoved < 0.05 ? 10 : alreadyMoved < 0.1 ? 4 : 0;
  opportunity = clamp(Math.round(opportunity));
  let risk = asset.vol * 45 + (asset.type === "crypto" ? 14 : 0);
  risk += cap < 40 ? 14 : cap < 120 ? 7 : 0;
  risk += alreadyMoved > 0.12 ? 14 : alreadyMoved > 0.06 ? 7 : 0;
  risk += (sig.verif === "rumor" || sig.verif === "unverified") ? 12 : 0;
  risk = clamp(Math.round(risk));
  const confidence = clamp(Math.round(directness * 70 + (verifBonus / 8) * 22 + Math.min(8, sig.confirmations * 3)));
  return {
    asset, role,
    directnessScore: Math.round(directness * 100),
    opportunityScore: opportunity, riskScore: risk, confidenceScore: confidence,
    alreadyPricedInScore: clamp(Math.round(alreadyMoved * 100)),
    marketReactionScore: clamp(Math.round(Math.abs(changeH1Pct) * 5)),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const SECTOR_CHAIN: Record<string, string[]> = {
  ai: ["chips", "chip_equipment", "memory", "servers", "cooling", "power", "datacenter", "fiber", "cyber"],
  datacenter: ["chips", "servers", "cooling", "power", "datacenter", "fiber"],
  defense: ["defense", "space", "cyber"],
  energy: ["power", "oil", "gas", "nuclear"],
  crypto: ["crypto", "payments"],
};
