import { askJson, aiConfigured } from "../ai/client";
import { AgentConclusion, Stance } from "./consensus";
import { AgentRole, roleById } from "./roles";

/**
 * The real specialist-agent analysis. Each permanent role is a separate prompt with a
 * separate job, so the room genuinely contains different specialists rather than one
 * model answering the same question 22 times.
 *
 * When the model cannot be reached the agent returns `available: false` with the real
 * reason and takes no stance. There is no heuristic stand-in here on purpose: a fake
 * conclusion presented as agent analysis is exactly what this file must not produce.
 */

export interface Observation {
  title?: string; url?: string; domain?: string; snippet?: string;
  publishedAt?: string | null; provider?: string;
}

export const CONCLUSION_SCHEMA = {
  type: "object",
  properties: {
    stance: { type: "string", enum: ["agree", "disagree", "uncertain"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    evidenceQuality: { type: "integer", minimum: 0, maximum: 100 },
    argument: { type: "string" },
    citedUrls: { type: "array", items: { type: "string" } },
    contradicts: { type: "array", items: { type: "string" } },
    openQuestion: { type: ["string", "null"] },
  },
  required: ["stance", "confidence", "evidenceQuality", "argument", "citedUrls", "contradicts", "openQuestion"],
  additionalProperties: false,
} as const;

const BASE_SYSTEM = [
  "אתה סוכן מומחה בחדר מחקר פיננסי. המערכת היא SIMULATION ONLY — אין מסחר אמיתי, אין ברוקר, אין הוראות קנייה/מכירה.",
  "חוקי ברזל:",
  "1. אל תמציא עובדות, ציטוטים, מחירים, דיווחים או מקורות. אם אין ראיה — אמור זאת במפורש.",
  "2. צטט רק כתובות URL שמופיעות בראיות שקיבלת. אסור להמציא URL.",
  "3. אתה חייב לחלוק על התזה כשהראיות לא תומכות בה. הסכמה אוטומטית היא כישלון.",
  "4. אם חסר לך מידע קריטי — נסח שאלת מחקר אחת וממוקדת ב-openQuestion.",
  "5. confidence משקף את חוזק הראיות שלך בלבד, לא את מידת ההסכמה עם סוכנים אחרים.",
  "ענה בעברית, בקצרה ולעניין.",
].join("\n");

function observationsBlock(observations: Observation[]): string {
  if (!observations.length) return "(לא סופקו ראיות)";
  return observations.slice(0, 25).map((o, i) =>
    `[${i + 1}] ${o.title || "(ללא כותרת)"}\n    מקור: ${o.domain || o.url || "לא ידוע"}` +
    `\n    פורסם: ${o.publishedAt || "תאריך לא ידוע"}` +
    `\n    URL: ${o.url || "אין"}` +
    `\n    תקציר: ${(o.snippet || "").slice(0, 400)}`).join("\n\n");
}

function offline(agentId: string, reason: string, round: string, temporary = false): AgentConclusion {
  return {
    agentId, stance: "uncertain", confidence: 0, evidenceQuality: 0,
    argument: `לא בוצע ניתוח — שכבת ה-AI אינה זמינה: ${reason}`,
    available: false, unavailableReason: reason,
    citedUrls: [], openQuestion: null, contradicts: [], round, temporary,
  };
}

export interface AnalyzeOptions {
  round?: string;
  /** Conclusions from other agents, shown only in the challenge/debate rounds. */
  peerClaims?: { agentId: string; stance: Stance; argument: string }[];
  effort?: "low" | "medium" | "high";
}

/** One permanent specialist forms (or revises) a conclusion. */
export async function analyzeWithRole(
  role: AgentRole, question: string, observations: Observation[], opts: AnalyzeOptions = {},
): Promise<AgentConclusion> {
  const round = opts.round || "INDEPENDENT";
  if (!aiConfigured()) return offline(role.id, "AI_API_KEY לא מוגדר", round);

  const peers = opts.peerClaims?.length
    ? `\n\nטענות של סוכנים אחרים (בחן אותן בביקורתיות; אתה רשאי לחלוק):\n` +
      opts.peerClaims.map((p) => `- ${p.agentId} [${p.stance}]: ${p.argument.slice(0, 300)}`).join("\n")
    : "";

  const res = await askJson<Omit<AgentConclusion, "agentId">>({
    system: `${BASE_SYSTEM}\n\nהתפקיד שלך: ${role.name} — ${role.focus}. נתח אך ורק מזווית ההתמחות הזו.`,
    prompt:
      `שאלת החקירה: ${question}\n\nסבב: ${round}\n\nראיות זמינות:\n${observationsBlock(observations)}${peers}\n\n` +
      `החזר JSON בלבד: stance (agree/disagree/uncertain ביחס לתזה בשאלה), confidence, evidenceQuality, ` +
      `argument (הנימוק שלך), citedUrls (רק URL מהראיות שלמעלה), contradicts (טענות שהראיות סותרות), ` +
      `openQuestion (שאלת מחקר אחת שחסרה לך, או null).`,
    schema: CONCLUSION_SCHEMA as any,
    effort: opts.effort ?? "low",
    maxTokens: 1600,
  });

  if (!res.ok || !res.data) return offline(role.id, res.reason || "AI לא זמין", round);
  const d: any = res.data;
  return {
    agentId: role.id,
    stance: (["agree", "disagree", "uncertain"].includes(d.stance) ? d.stance : "uncertain") as Stance,
    confidence: Math.max(0, Math.min(100, Number(d.confidence) || 0)),
    evidenceQuality: Math.max(0, Math.min(100, Number(d.evidenceQuality) || 0)),
    argument: String(d.argument || ""),
    available: true,
    citedUrls: Array.isArray(d.citedUrls) ? d.citedUrls.filter((u: any) => typeof u === "string") : [],
    contradicts: Array.isArray(d.contradicts) ? d.contradicts.filter((c: any) => typeof c === "string") : [],
    openQuestion: d.openQuestion || null,
    round,
  };
}

/**
 * A temporary specialist created by the governor for ONE research gap.
 * It has no standing role — only the question it was born to answer — and the
 * orchestrator destroys it as soon as it reports.
 */
export async function analyzeTemporary(
  agentId: string, researchQuestion: string, job: string, observations: Observation[],
): Promise<AgentConclusion> {
  const round = "VERIFY_CHALLENGE";
  if (!aiConfigured()) return offline(agentId, "AI_API_KEY לא מוגדר", round, true);

  const res = await askJson<Omit<AgentConclusion, "agentId">>({
    system: `${BASE_SYSTEM}\n\nאתה מומחה זמני שנוצר למטרה אחת בלבד: ${job}. אל תרחיב מעבר לשאלה שלך.`,
    prompt:
      `שאלת המחקר הספציפית: ${researchQuestion}\n\nראיות זמינות:\n${observationsBlock(observations)}\n\n` +
      `אם הראיות אינן מספיקות כדי לענות — קבע stance="uncertain" והסבר בדיוק מה חסר. אל תשלים פערים בניחוש.\n` +
      `החזר JSON בלבד.`,
    schema: CONCLUSION_SCHEMA as any,
    effort: "medium",
    maxTokens: 1600,
  });

  if (!res.ok || !res.data) return offline(agentId, res.reason || "AI לא זמין", round, true);
  const d: any = res.data;
  return {
    agentId,
    stance: (["agree", "disagree", "uncertain"].includes(d.stance) ? d.stance : "uncertain") as Stance,
    confidence: Math.max(0, Math.min(100, Number(d.confidence) || 0)),
    evidenceQuality: Math.max(0, Math.min(100, Number(d.evidenceQuality) || 0)),
    argument: String(d.argument || ""),
    available: true,
    citedUrls: Array.isArray(d.citedUrls) ? d.citedUrls.filter((u: any) => typeof u === "string") : [],
    contradicts: Array.isArray(d.contradicts) ? d.contradicts.filter((c: any) => typeof c === "string") : [],
    openQuestion: d.openQuestion || null,
    round, temporary: true,
  };
}

/** Default analyze hook used by the orchestrator — resolves the role, then calls the real model. */
export function makeRoleAnalyzer(opts: AnalyzeOptions = {}) {
  return async (agentId: string, question: string, observations: Observation[]): Promise<AgentConclusion> => {
    const role = roleById(agentId);
    if (!role) return offline(agentId, `תפקיד לא מוכר: ${agentId}`, opts.round || "INDEPENDENT");
    return analyzeWithRole(role, question, observations, opts);
  };
}
