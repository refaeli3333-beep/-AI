// EconomicImpactInvestigationEngine — from a statement to WHO may actually earn revenue.
// Pure & deterministic (no network): traverses the knowledge graph, never invents facts.
import { ASSET_UNIVERSE } from "../data/assets";
import { AssetLite } from "../analysis/investigate";
import { CAPABILITIES, TECHNOLOGIES, COMPONENTS, Capability } from "./knowledgeBase";
import { techsForSectors, componentsForTechs, traverse, capabilitiesForTechs, competitorsOf, edgesFor } from "./knowledgeGraph";

export type EvidenceMark = "fact" | "inference" | "assumption" | "missing";

export interface ImpactEvidence { sourceUrl: string; sourceType: string; title: string; extractedFact: string; relevanceScore: number; reliabilityScore: number; }

export interface CompanyImpact {
  companyName: string; ticker: string; roleInValueChain: string; directOrIndirect: "direct" | "indirect";
  productOrService: string; whyNeeded: string; whoPays: string; revenueMechanism: string;
  expectedTimeToRevenue: "immediate" | "short" | "medium" | "long";
  currentStage: string; distanceToRevenue: "short" | "medium" | "long"; whatsMissing: string[];
  evidenceLevel: number; dependencyLevel: number; competitionLevel: number;
  directnessScore: number; alreadyPricedInScore: number; opportunityScore: number; riskScore: number; confidenceScore: number;
  reactionCategory: string; archetype?: string; explanation: string; evidence: ImpactEvidence[];
}

export interface EconomicImpact {
  directMeaning: string; hiddenMeaning: string; possibleIntent: string; economicNeed: string;
  requiredTechnologies: string[]; requiredComponents: string[]; affectedSectors: string[];
  directBeneficiaries: string[]; indirectBeneficiaries: string[]; hiddenSuppliers: string[]; possibleLosers: string[];
  evidence: ImpactEvidence[]; assumptions: string[]; confirmationTriggers: string[]; invalidationTriggers: string[];
  confidenceScore: number; riskScore: number;
  valueChain: { event: string; need: string; technologies: string[]; components: string[]; companies: string[] };
  companies: CompanyImpact[]; // ranked, up to 5 (five archetypes)
  insufficient?: boolean; note?: string;
}

export interface ImpactInput {
  text: string; personName?: string; role?: string; publishedAt?: string | null; sourceType?: string;
  sectors: string[]; eventStage: string;
  mentioned?: { companies?: string[]; countries?: string[]; products?: string[] };
  sourceEvidence?: { url: string; type: string; title?: string; publishedAt?: string | null };
  priceChange?: Record<string, { changeH1Pct: number; changeNowPct: number; reacted: boolean; priceAtSignal?: number; currentPrice?: number }>;
}

const NEED_BY_SECTOR: Record<string, { need: string; whoPays: string }> = {
  ai: { need: "יותר כוח מחשוב לעומסי בינה מלאכותית", whoPays: "מפעילי ענן וארגונים" },
  datacenter: { need: "יותר קיבולת מרכזי נתונים, חשמל וקירור", whoPays: "מפעילי ענן ומרכזי נתונים" },
  defense: { need: "יותר מערכות הגנה, חיישנים ותחמושת", whoPays: "ממשלות וצבא" },
  energy: { need: "יותר ייצור והולכת חשמל / אנרגיה", whoPays: "חברות חשמל, ממשלות ותעשייה" },
  crypto: { need: "ודאות רגולטורית ואימוץ מוסדי", whoPays: "מוסדות פיננסיים ומשקיעים" },
};
const STAGE_ORDER = ["רמז", "אמירה", "כוונה", "תוכנית", "תקציב", "רגולציה", "מכרז", "חוזה", "הזמנה", "ייצור", "אספקה", "הכנסה"];
const STAGE_MAP: Record<string, string> = {
  hint: "רמז", opinion: "אמירה", statement: "אמירה", intent: "כוונה", plan: "תוכנית",
  bill: "רגולציה", gov_approval: "רגולציה", budget_approval: "תקציב", tender: "מכרז",
  signed_contract: "חוזה", production: "ייצור", delivery: "אספקה", revenue: "הכנסה",
};
const STAGE_WEIGHT: Record<string, number> = { hint: 20, opinion: 25, statement: 40, intent: 45, plan: 55, bill: 60, gov_approval: 75, budget_approval: 80, tender: 78, signed_contract: 92, production: 90, delivery: 95, revenue: 98 };

const ROLE_DIRECT: Record<string, number> = {
  beneficiary_direct: 1, component_supplier: 0.8, equipment_manufacturer: 0.72,
  infrastructure_provider: 0.62, software_provider: 0.55, beneficiary_indirect: 0.55,
  competitor: 0.4, possible_loser: 0.38,
};
const REVENUE_BY_ROLE: Record<string, string> = {
  beneficiary_direct: "מכירת המוצר המרכזי שנמצא בליבת האירוע",
  component_supplier: "מכירת רכיבים קריטיים ליצרנים בשרשרת",
  equipment_manufacturer: "מכירת ציוד ומכונות ייצור",
  infrastructure_provider: "אספקת תשתית (חשמל, קירור, שטח) לפרויקטים החדשים",
  software_provider: "רישוי תוכנה ושירותי אבטחה",
  beneficiary_indirect: "עלייה עקיפה בביקוש כתוצאה מהאירוע",
  competitor: "עלול לאבד נתח שוק",
  possible_loser: "עלול להיפגע מהאירוע",
};
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const bySymbol = (t: string): AssetLite | undefined => ASSET_UNIVERSE.find((a) => a.symbol === t);

function timeToRevenue(stage: string): CompanyImpact["expectedTimeToRevenue"] {
  const w = STAGE_WEIGHT[stage] ?? 40;
  if (w >= 95) return "immediate"; if (w >= 85) return "short"; if (w >= 60) return "medium"; return "long";
}
function distance(stage: string): { distanceToRevenue: "short" | "medium" | "long"; whatsMissing: string[] } {
  const heb = STAGE_MAP[stage] || "אמירה";
  const idx = STAGE_ORDER.indexOf(heb);
  const remaining = STAGE_ORDER.slice(idx + 1);
  const missing = ["תקציב", "מכרז", "חוזה", "רגולציה", "אספקה"].filter((s) => remaining.includes(s));
  const d = idx >= 8 ? "short" : idx >= 5 ? "medium" : "long";
  return { distanceToRevenue: d as any, whatsMissing: missing.length ? missing : ["אספקה בפועל"] };
}

function roleForCapability(cap: Capability): string {
  const tech = TECHNOLOGIES.find((t) => t.id === cap.technologyId);
  if (!tech) return "beneficiary_indirect";
  if (cap.capabilityType === "designs") return "beneficiary_direct";
  if (tech.category === "manufacturing") return "equipment_manufacturer";
  if (tech.category === "memory" || tech.category === "networking") return "component_supplier";
  if (tech.category === "infrastructure" || tech.category === "energy") return "infrastructure_provider";
  if (tech.category === "software") return "software_provider";
  if (tech.category === "defense" || tech.category === "space") return "beneficiary_direct"; // prime builds the end system
  if (cap.capabilityType === "manufactures") return "component_supplier";
  return "beneficiary_indirect";
}

function scoreCompany(role: string, cap: Capability | null, stage: string, alreadyMovedPct: number, asset?: AssetLite) {
  const cap_conf = cap?.confidence ?? 60;
  const directness = (ROLE_DIRECT[role] ?? 0.5);
  const significance = Math.min(1, (8 / Math.sqrt(asset?.marketCap || 100)) * ((STAGE_WEIGHT[stage] ?? 40) / 100));
  const alreadyMoved = Math.abs(alreadyMovedPct) / 100;
  let opp = directness * 36 + significance * 22 + (cap_conf / 100) * 12;
  opp += alreadyMoved < 0.02 ? 18 : alreadyMoved < 0.05 ? 10 : alreadyMoved < 0.1 ? 4 : 0;
  if (role === "competitor" || role === "possible_loser") opp = Math.min(opp, 30);
  const vol = asset?.vol ?? 0.4, cap$ = asset?.marketCap ?? 100;
  let risk = vol * 45 + (cap$ < 40 ? 14 : cap$ < 120 ? 7 : 0) + (alreadyMoved > 0.12 ? 14 : alreadyMoved > 0.06 ? 7 : 0);
  const confidence = clamp(directness * 60 + (cap_conf / 100) * 30);
  return { directnessScore: clamp(directness * 100), opportunityScore: clamp(opp), riskScore: clamp(risk), confidenceScore: confidence, alreadyPricedInScore: clamp(alreadyMoved * 100) };
}

function reactionCategory(directness: number, changeNowPct: number | undefined, reacted: boolean | undefined, role: string): string {
  if (role === "possible_loser" || role === "competitor") return "עלולה להיפגע";
  const strong = directness >= 70;
  if (reacted === undefined) return strong ? "קשר חזק" : "קשר עקיף";
  if (strong && reacted) return "קשר חזק והמחיר כבר הגיב";
  if (strong && !reacted) return "קשר חזק והמחיר עדיין לא הגיב";
  return "קשר עקיף";
}

export class EconomicImpactInvestigationEngine {
  investigate(input: ImpactInput): EconomicImpact {
    const sectors = input.sectors.filter((s) => NEED_BY_SECTOR[s]);
    const techs = techsForSectors(input.sectors);
    const techIds = techs.map((t) => t.id);
    const comps = componentsForTechs(techIds);

    // no technology/company match → be explicit, do not hallucinate
    const capMatches = capabilitiesForTechs(techIds);
    if (!sectors.length || !capMatches.length) {
      return this.insufficient(input);
    }

    const need = NEED_BY_SECTOR[sectors[0]];
    const traversed = traverse(techIds, 2);

    // build company impacts from capabilities (hop 0) + supply-edge companies (hop 1+)
    const impacts: CompanyImpact[] = [];
    const seen = new Set<string>();
    for (const cap of capMatches) {
      if (seen.has(cap.companyTicker)) continue; seen.add(cap.companyTicker);
      impacts.push(this.buildImpact(cap.companyTicker, cap, roleForCapability(cap), input, need.whoPays));
    }
    // hidden suppliers via edges (companies reached by traversal not already added)
    for (const node of traversed) {
      if (seen.has(node.ticker)) continue; seen.add(node.ticker);
      const cap = CAPABILITIES.find((c) => c.companyTicker === node.ticker) || null;
      impacts.push(this.buildImpact(node.ticker, cap, "infrastructure_provider", input, need.whoPays));
    }
    // possible losers = competitors of the strongest direct beneficiaries
    const directTickers = impacts.filter((i) => i.roleInValueChain === "beneficiary_direct").map((i) => i.ticker);
    for (const c of competitorsOf(directTickers)) {
      if (seen.has(c.ticker)) continue; seen.add(c.ticker);
      const cap = CAPABILITIES.find((x) => x.companyTicker === c.ticker) || null;
      impacts.push(this.buildImpact(c.ticker, cap, "possible_loser", input, need.whoPays));
    }

    impacts.sort((a, b) => b.opportunityScore - a.opportunityScore);
    const ranked = this.pickFiveArchetypes(impacts);

    const evidence = this.collectEvidence(ranked, input);
    const confidence = Math.round(ranked.reduce((s, c) => s + c.confidenceScore, 0) / Math.max(1, ranked.length));
    const risk = Math.round(ranked.reduce((s, c) => s + c.riskScore, 0) / Math.max(1, ranked.length));

    return {
      directMeaning: `${input.personName || "הדובר"} התייחס ל${sectors.map((s) => (NEED_BY_SECTOR[s]?.need || s)).slice(0, 1)}.`,
      hiddenMeaning: `מעבר לאמירה הישירה, המשמעות היא ${need.need}.`,
      possibleIntent: this.intent(input.eventStage),
      economicNeed: need.need,
      requiredTechnologies: techs.map((t) => t.name),
      requiredComponents: comps.map((c) => c.name),
      affectedSectors: sectors,
      directBeneficiaries: impacts.filter((i) => i.roleInValueChain === "beneficiary_direct").map((i) => i.ticker),
      indirectBeneficiaries: impacts.filter((i) => i.directOrIndirect === "indirect" && i.roleInValueChain !== "possible_loser").map((i) => i.ticker),
      hiddenSuppliers: impacts.filter((i) => ["component_supplier", "equipment_manufacturer", "infrastructure_provider"].includes(i.roleInValueChain)).map((i) => i.ticker),
      possibleLosers: impacts.filter((i) => i.roleInValueChain === "possible_loser").map((i) => i.ticker),
      evidence,
      assumptions: [
        "המיפוי מבוסס על יכולות ידועות של החברות (מסומן כמסקנה, לא כעובדה על הכנסה עתידית).",
        "קשר בזמן בין הפרסום לתנועת מחיר אינו מוכיח סיבתיות.",
      ],
      confirmationTriggers: this.confirmations(input.eventStage),
      invalidationTriggers: ["הכחשה רשמית", "ביטול התוכנית", "בעיה רגולטורית", "דוח חלש", "המחיר כבר עלה יותר מדי"],
      confidenceScore: confidence, riskScore: risk,
      valueChain: {
        event: input.text.slice(0, 80), need: need.need,
        technologies: techs.slice(0, 6).map((t) => t.name), components: comps.slice(0, 6).map((c) => c.name),
        companies: ranked.map((r) => r.ticker),
      },
      companies: ranked,
    };
  }

  private buildImpact(ticker: string, cap: Capability | null, role: string, input: ImpactInput, whoPays: string): CompanyImpact {
    const asset = bySymbol(ticker);
    const pc = input.priceChange?.[ticker];
    const s = scoreCompany(role, cap, input.eventStage, pc?.changeH1Pct ?? 0, asset);
    const dist = distance(input.eventStage);
    const tech = cap ? TECHNOLOGIES.find((t) => t.id === cap.technologyId) : undefined;
    const direct = role === "beneficiary_direct";
    const explanation =
      `${cap?.productName || ticker} רלוונטי כי האירוע דורש ${tech?.name || "רכיבים בשרשרת"}. ` +
      `ככל שהפרויקט יתקדם, ${ticker} עשויה ליהנות מהזמנות אם יעבור לשלבי תקציב, חוזה ואספקה. ` +
      (input.eventStage === "signed_contract" ? "קיים כבר שלב חוזה." : "כרגע אין חוזה חתום ולכן רמת הביטחון אינה מלאה.");
    return {
      companyName: asset?.name || ticker, ticker, roleInValueChain: role,
      directOrIndirect: direct ? "direct" : "indirect",
      productOrService: cap?.productName || (asset?.name || ticker),
      whyNeeded: tech ? `נדרש עבור ${tech.name}` : "חלק משרשרת האספקה של האירוע",
      whoPays, revenueMechanism: REVENUE_BY_ROLE[role] || "עלייה בביקוש",
      expectedTimeToRevenue: timeToRevenue(input.eventStage),
      currentStage: STAGE_MAP[input.eventStage] || "אמירה",
      distanceToRevenue: dist.distanceToRevenue, whatsMissing: dist.whatsMissing,
      evidenceLevel: cap?.confidence ?? 40, dependencyLevel: role === "beneficiary_direct" ? 90 : 60,
      competitionLevel: role === "possible_loser" ? 90 : 50,
      directnessScore: s.directnessScore, alreadyPricedInScore: s.alreadyPricedInScore,
      opportunityScore: s.opportunityScore, riskScore: s.riskScore, confidenceScore: s.confidenceScore,
      reactionCategory: reactionCategory(s.directnessScore, pc?.changeNowPct, pc?.reacted, role),
      explanation,
      evidence: cap ? [{ sourceUrl: cap.evidenceUrl, sourceType: cap.evidenceType, title: cap.productName, extractedFact: `${asset?.name || ticker} מספקת ${cap.productName}`, relevanceScore: 85, reliabilityScore: cap.confidence }] : [],
    };
  }

  private pickFiveArchetypes(impacts: CompanyImpact[]): CompanyImpact[] {
    const out: CompanyImpact[] = []; const used = new Set<string>();
    const take = (pred: (c: CompanyImpact) => boolean, label: string) => {
      const c = impacts.find((x) => !used.has(x.ticker) && pred(x));
      if (c) { used.add(c.ticker); out.push({ ...c, archetype: label }); }
    };
    take((c) => c.roleInValueChain === "beneficiary_direct", "הנהנית הישירה ביותר");
    take((c) => c.roleInValueChain === "component_supplier", "ספקית הרכיב הקריטי");
    take((c) => ["equipment_manufacturer", "infrastructure_provider"].includes(c.roleInValueChain), "ספקית נסתרת");
    take((c) => c.reactionCategory === "קשר חזק והמחיר עדיין לא הגיב", "חברה שעדיין לא הגיבה");
    take((c) => c.roleInValueChain === "possible_loser", "חברה שעלולה להיפגע");
    for (const c of impacts) { if (out.length >= 5) break; if (!used.has(c.ticker)) { used.add(c.ticker); out.push(c); } }
    return out.slice(0, 5);
  }

  private collectEvidence(companies: CompanyImpact[], input: ImpactInput): ImpactEvidence[] {
    const ev: ImpactEvidence[] = [];
    if (input.sourceEvidence?.url) ev.push({ sourceUrl: input.sourceEvidence.url, sourceType: input.sourceEvidence.type, title: input.sourceEvidence.title || "מקור הפרסום", extractedFact: input.text.slice(0, 120), relevanceScore: 90, reliabilityScore: 70 });
    companies.forEach((c) => c.evidence.forEach((e) => ev.push(e)));
    return ev;
  }

  private intent(stage: string): string {
    const w = STAGE_WEIGHT[stage] ?? 40;
    if (w >= 85) return "כוונה מבוצעת — קרוב להכנסה בפועל.";
    if (w >= 60) return "כוונה מתקדמת — עבר לשלב תקציב/רגולציה.";
    return "כוונה מוקדמת — עדיין אמירה או תוכנית ללא התחייבות.";
  }
  private confirmations(stage: string): string[] {
    const base = ["הודעה רשמית", "אישור תקציב", "פרסום מכרז", "חתימת חוזה", "עלייה בהכנסות בדוח"];
    return base;
  }
  private insufficient(input: ImpactInput): EconomicImpact {
    return {
      directMeaning: input.text.slice(0, 120), hiddenMeaning: "", possibleIntent: "", economicNeed: "",
      requiredTechnologies: [], requiredComponents: [], affectedSectors: input.sectors,
      directBeneficiaries: [], indirectBeneficiaries: [], hiddenSuppliers: [], possibleLosers: [],
      evidence: [], assumptions: [], confirmationTriggers: [], invalidationTriggers: [],
      confidenceScore: 0, riskScore: 0,
      valueChain: { event: input.text.slice(0, 80), need: "", technologies: [], components: [], companies: [] },
      companies: [], insufficient: true,
      note: "אין כרגע מספיק ראיות כדי לקבוע איזו חברה עשויה ליהנות.",
    };
  }
}
