// Translates the original text to Hebrew, preserving the source. Real via Google
// Translate v2 when TRANSLATION_API_KEY exists; otherwise returns the original,
// flagged as not-live so the UI can show reduced data completeness.
export interface Translation { text: string; sourceLanguage: string; confidence: number; provider: string; live: boolean; }

export async function translateToHebrew(text: string, sourceGuess = "en"): Promise<Translation> {
  const key = process.env.TRANSLATION_API_KEY;
  if (!text) return { text: "", sourceLanguage: sourceGuess, confidence: 0, provider: "none", live: false };
  if (/[\u0590-\u05FF]/.test(text)) return { text, sourceLanguage: "he", confidence: 1, provider: "passthrough", live: true };
  if (!key) return { text, sourceLanguage: sourceGuess, confidence: 0, provider: "mock", live: false };
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: text.slice(0, 5000), target: "he", format: "text" }),
    });
    if (!res.ok) return { text, sourceLanguage: sourceGuess, confidence: 0, provider: "google", live: false };
    const j: any = await res.json();
    const tr = j.data?.translations?.[0];
    return { text: tr?.translatedText || text, sourceLanguage: tr?.detectedSourceLanguage || sourceGuess, confidence: 0.9, provider: "google", live: true };
  } catch {
    return { text, sourceLanguage: sourceGuess, confidence: 0, provider: "google", live: false };
  }
}
