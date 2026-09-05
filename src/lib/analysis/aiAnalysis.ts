// Statement analysis: entities, event, stage, sectors, meaning.
// Real via the shared Anthropic client (src/lib/ai/client.ts) when a key is configured;
// otherwise a deterministic keyword heuristic so the pipeline always produces structured
// output. The heuristic is explicitly tagged provider="heuristic" / live=false, which the
// pipeline surfaces as analysis_source=MOCK — it is never presented as real AI analysis.
import { askJson, aiConfigured } from "../ai/client";

export interface Analysis {
  topic: string; eventType: string; eventStage: string; sectors: string[]; // canonical: ai|datacenter|defense|energy|crypto
  directQuoteFound: boolean; meaning: string;
  entities: { people: string[]; companies: string[]; products: string[]; countries: string[] };
  confidence: number; provider: string; live: boolean;
  /** Why real AI analysis was not used. Set only when live === false. Surfaced, never hidden. */
  unavailableReason?: string;
}

const SECTOR_KEYWORDS: Record<string, string[]> = {
  ai: ["artificial intelligence", "ai ", "data center", "datacenter", "gpu", "chip", "semiconductor", "בינה מלאכותית", "שבב", "מרכזי נתונים"],
  defense: ["defense", "missile", "military", "weapon", "army", "ביטחון", "צבא", "טיל", "נשק"],
  energy: ["oil", "gas", "energy", "opec", "barrel", "נפט", "אנרגיה", "גז", "דלק"],
  crypto: ["crypto", "bitcoin", "ethereum", "etf", "blockchain", "קריפטו", "ביטקוין", "בלוקצ'יין"],
  datacenter: ["cloud", "server", "hosting", "ענן", "שרת"],
};
const STAGE_KEYWORDS: [string, string[]][] = [
  ["signed_contract", ["signed", "contract awarded", "חתמנו", "חוזה"]],
  ["budget_approval", ["budget approved", "approved funding", "אישור תקציב"]],
  ["gov_approval", ["approved", "authorized", "אישרה", "אישור"]],
  ["plan", ["plan", "planning", "intend", "מתכננים", "תוכנית"]],
  ["statement", ["said", "announced", "declared", "הודיע", "אמר", "הצהיר"]],
];

export function heuristicAnalysis(text: string): Analysis {
  const t = text.toLowerCase();
  const sectors = Object.entries(SECTOR_KEYWORDS)
    .filter(([, kws]) => kws.some((k) => t.includes(k)))
    .map(([s]) => s);
  const stage = (STAGE_KEYWORDS.find(([, kws]) => kws.some((k) => t.includes(k.toLowerCase())))?.[0]) || "statement";
  const eventType = sectors.includes("defense") ? "defense_budget"
    : sectors.includes("ai") ? "ai_investment"
    : sectors.includes("energy") ? "energy_supply"
    : sectors.includes("crypto") ? "crypto_regulation" : "statement";
  return {
    topic: sectors[0] ? `נושא בתחום ${sectors[0]}` : "אמירה כללית",
    eventType, eventStage: stage, sectors,
    directQuoteFound: /["“”]/.test(text),
    meaning: sectors.length ? `ייתכן גידול עתידי בביקוש בסקטורים: ${sectors.join(", ")}.` : "לא זוהתה השפעה ברורה על סקטור מסוים.",
    entities: { people: [], companies: [], products: [], countries: [] },
    confidence: Math.min(90, 30 + sectors.length * 20),
    provider: "heuristic", live: false,
  };
}

/** Canonical stages the downstream investigation engine actually scores (investigate.ts). */
const EVENT_STAGES = [
  "hint", "opinion", "statement", "intent", "plan", "bill",
  "gov_approval", "budget_approval", "tender", "signed_contract", "production", "delivery", "revenue",
] as const;

const strArray = { type: "array", items: { type: "string" } } as const;

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    eventType: { type: "string" },
    eventStage: { type: "string", enum: [...EVENT_STAGES] },
    sectors: { type: "array", items: { type: "string", enum: ["ai", "datacenter", "defense", "energy", "crypto"] } },
    directQuoteFound: { type: "boolean" },
    meaning: { type: "string" },
    entities: {
      type: "object",
      properties: { people: strArray, companies: strArray, products: strArray, countries: strArray },
      required: ["people", "companies", "products", "countries"],
      additionalProperties: false,
    },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["topic", "eventType", "eventStage", "sectors", "directQuoteFound", "meaning", "entities", "confidence"],
  additionalProperties: false,
} as const;

const SYSTEM = [
  "אתה מנתח אמירות ציבוריות עבור מערכת מודיעין פיננסי. המערכת היא SIMULATION ONLY.",
  "אל תמציא עובדות, חברות, מוצרים או מספרים שאינם נובעים מהטקסט שקיבלת.",
  "אם לא זוהה סקטור רלוונטי — החזר sectors ריק. עדיף להחזיר פחות מאשר לנחש.",
  "confidence משקף עד כמה הטקסט עצמו תומך בניתוח, לא עד כמה הנושא מעניין.",
].join("\n");

type AnalysisPayload = Pick<Analysis,
  "topic" | "eventType" | "eventStage" | "sectors" | "directQuoteFound" | "meaning" | "entities" | "confidence">;

/**
 * Real analysis through the shared AI client (same key resolution, same AI_MODEL and the
 * same NOT_AVAILABLE reporting as the agent layer). Any failure — no key, billing, refusal,
 * bad JSON — falls back to the heuristic and carries the real reason, tagged live=false.
 */
export async function analyzeStatement(text: string): Promise<Analysis> {
  const base = heuristicAnalysis(text);
  if (!text) return base;
  if (!aiConfigured()) return { ...base, unavailableReason: "AI_API_KEY לא מוגדר — ניתוח היוריסטי (MOCK)" };

  const res = await askJson<AnalysisPayload>({
    system: SYSTEM,
    prompt:
      `נתח את האמירה הבאה והחזר JSON בלבד.\n` +
      `sectors: תת-קבוצה של ai,datacenter,defense,energy,crypto (ריק אם אין).\n` +
      `eventStage: אחד מ-${EVENT_STAGES.join(",")}.\n` +
      `entities: רק ישויות שמופיעות בטקסט.\n\nהאמירה:\n"""${text.slice(0, 4000)}"""`,
    schema: ANALYSIS_SCHEMA as any,
    maxTokens: 2000,
    effort: "low",
  });

  if (!res.ok || !res.data) return { ...base, unavailableReason: res.reason || "ניתוח AI אינו זמין" };
  return { ...base, ...res.data, provider: "anthropic", live: true };
}
