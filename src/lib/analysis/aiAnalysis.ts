// Statement analysis: entities, event, stage, sectors, meaning.
// Real via an LLM when AI_API_KEY is set; otherwise a deterministic keyword heuristic
// so the pipeline always produces structured output (never an empty function).
export interface Analysis {
  topic: string; eventType: string; eventStage: string; sectors: string[]; // canonical: ai|datacenter|defense|energy|crypto
  directQuoteFound: boolean; meaning: string;
  entities: { people: string[]; companies: string[]; products: string[]; countries: string[] };
  confidence: number; provider: string; live: boolean;
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

export async function analyzeStatement(text: string): Promise<Analysis> {
  const key = process.env.AI_API_KEY;
  if (!key || !text) return heuristicAnalysis(text);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5", max_tokens: 700,
        messages: [{
          role: "user",
          content: `Return ONLY JSON (no prose) with keys topic,eventType,eventStage,sectors (subset of ai,datacenter,defense,energy,crypto),directQuoteFound,meaning,entities{people,companies,products,countries},confidence(0-100). Statement:\n"""${text.slice(0, 4000)}"""`,
        }],
      }),
    });
    if (!res.ok) return heuristicAnalysis(text);
    const j: any = await res.json();
    const raw = (j.content || []).map((b: any) => b.text || "").join("").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return { ...heuristicAnalysis(text), ...parsed, provider: "anthropic", live: true };
  } catch {
    return heuristicAnalysis(text);
  }
}
