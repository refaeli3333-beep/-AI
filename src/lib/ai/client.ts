import Anthropic from "@anthropic-ai/sdk";

/**
 * Single Anthropic entry point for the whole app.
 *
 * The rule this file exists to enforce: when the real model cannot be called —
 * no key, billing problem, network failure, refusal — callers get NOT_AVAILABLE
 * with the real reason. They never get invented model output.
 */

export type AiState = "LIVE" | "NOT_AVAILABLE";

/** Historic env name in this project is AI_API_KEY; ANTHROPIC_API_KEY is also accepted. */
function apiKey(): string {
  return process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
}

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5";

let _client: Anthropic | null = null;
export function getAiClient(): Anthropic | null {
  const key = apiKey();
  if (!key) return null;
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

export function aiConfigured(): boolean { return !!apiKey(); }

export interface AiResult<T> {
  ok: boolean;
  state: AiState;
  data?: T;
  /** Human-readable reason when state is NOT_AVAILABLE. Never hidden from the UI. */
  reason?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AskJsonOptions {
  system: string;
  prompt: string;
  schema: Record<string, any>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * One structured-output call. Returns parsed JSON matching `schema`, or a
 * NOT_AVAILABLE result carrying the real failure reason.
 */
export async function askJson<T>(opts: AskJsonOptions): Promise<AiResult<T>> {
  const client = getAiClient();
  if (!client) {
    return { ok: false, state: "NOT_AVAILABLE", reason: "AI_API_KEY לא מוגדר — ניתוח AI אמיתי אינו זמין" };
  }

  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "medium",
        format: { type: "json_schema", schema: opts.schema },
      },
      messages: [{ role: "user", content: opts.prompt }],
    });

    if (res.stop_reason === "refusal") {
      return { ok: false, state: "NOT_AVAILABLE", model: AI_MODEL,
        reason: `המודל סירב לענות (${res.stop_details?.category ?? "refusal"})` };
    }

    const text = res.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim();
    if (!text) return { ok: false, state: "NOT_AVAILABLE", model: AI_MODEL, reason: "תשובה ריקה מהמודל" };

    let data: T;
    try { data = JSON.parse(text) as T; }
    catch { return { ok: false, state: "NOT_AVAILABLE", model: AI_MODEL, reason: "תשובת המודל אינה JSON תקין" }; }

    return {
      ok: true, state: "LIVE", data, model: AI_MODEL,
      inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens,
    };
  } catch (e: any) {
    // Billing, auth, rate limit and network failures all land here and are reported
    // verbatim — the caller must surface OFFLINE, not substitute a guess.
    const status = e?.status ? ` (HTTP ${e.status})` : "";
    return { ok: false, state: "NOT_AVAILABLE", model: AI_MODEL, reason: `שגיאת AI${status}: ${e?.message || "unknown"}` };
  }
}

/** Real connectivity probe — an actual minimal request, not a key-presence check. */
export async function aiHealthCheck(): Promise<{ state: AiState; message: string; model: string }> {
  if (!aiConfigured()) return { state: "NOT_AVAILABLE", message: "AI_API_KEY לא מוגדר", model: AI_MODEL };
  const r = await askJson<{ ok: boolean }>({
    system: "Reply with JSON only.",
    prompt: 'Return {"ok": true}.',
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    maxTokens: 64, effort: "low",
  });
  return r.ok
    ? { state: "LIVE", message: `Connected — ${AI_MODEL}`, model: AI_MODEL }
    : { state: "NOT_AVAILABLE", message: r.reason || "לא זמין", model: AI_MODEL };
}
