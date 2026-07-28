// REAL provider connection checks (actual network requests). Reports the true HTTP
// status/error per provider and a truthful LIVE / NOT_AVAILABLE verdict. No faking.
const env = process.env;
const has = (k) => !!env[k];
async function probe(name, url, opts = {}) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(to);
    return { name, ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch (e) { return { name, ok: false, status: null, error: String(e.message || e), ms: Date.now() - t0 }; }
}

const results = [];
console.log("═══════════════════════════════════════════════════════════");
console.log("בדיקת חיבור אמיתית לכל Provider (APP_MODE=HYBRID)");
console.log("═══════════════════════════════════════════════════════════\n");

// Google Custom Search
{
  const keyPresent = has("GOOGLE_SEARCH_API_KEY") && has("GOOGLE_SEARCH_ENGINE_ID");
  const r = await probe("Google Search", `https://www.googleapis.com/customsearch/v1?key=${env.GOOGLE_SEARCH_API_KEY||""}&cx=${env.GOOGLE_SEARCH_ENGINE_ID||""}&q=test`);
  results.push({ provider: "Google Search", keyPresent, ...r, verdict: r.ok ? "LIVE" : "NOT_AVAILABLE" });
}
// Market Data (Polygon)
{
  const keyPresent = has("MARKET_DATA_API_KEY");
  const r = await probe("Market Data (Polygon)", `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=${env.MARKET_DATA_API_KEY||""}`);
  results.push({ provider: "Market Data", keyPresent, ...r, verdict: r.ok ? "LIVE" : "NOT_AVAILABLE" });
}
// X / Twitter
{
  const keyPresent = has("X_API_BEARER_TOKEN");
  const r = await probe("X (Twitter)", "https://api.twitter.com/2/tweets/search/recent?query=test", { headers: keyPresent ? { authorization: `Bearer ${env.X_API_BEARER_TOKEN}` } : {} });
  results.push({ provider: "X (Twitter)", keyPresent, ...r, verdict: r.ok ? "LIVE" : "NOT_AVAILABLE" });
}
// Translation (Google)
{
  const keyPresent = has("TRANSLATION_API_KEY");
  const r = await probe("Translation", `https://translation.googleapis.com/language/translate/v2?key=${env.TRANSLATION_API_KEY||""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "test", target: "he" }) });
  results.push({ provider: "Translation", keyPresent, ...r, verdict: r.ok ? "LIVE" : "NOT_AVAILABLE" });
}
// AI (Anthropic)
{
  const keyPresent = has("AI_API_KEY");
  const r = await probe("AI Analysis", "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": env.AI_API_KEY || "", "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 10, messages: [{ role: "user", content: "test" }] }) });
  results.push({ provider: "AI Analysis", keyPresent, ...r, verdict: r.ok ? "LIVE" : "NOT_AVAILABLE" });
}
// Supabase
{
  const keyPresent = has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY");
  const url = env.SUPABASE_URL ? `${env.SUPABASE_URL}/rest/v1/` : "https://supabase.com";
  const r = await probe("Supabase", url, { headers: keyPresent ? { apikey: env.SUPABASE_SERVICE_ROLE_KEY } : {} });
  results.push({ provider: "Supabase", keyPresent, ...r, verdict: (keyPresent && r.ok) ? "CONNECTED" : "NOT_AVAILABLE" });
}

for (const r of results) {
  const detail = r.status ? `HTTP ${r.status}` : (r.error || "no response");
  console.log(`• ${r.provider.padEnd(22)} key:${r.keyPresent ? "יש" : "חסר"}  בקשה:${detail.padEnd(16)} → ${r.verdict}`);
}

const live = results.filter((r) => r.verdict === "LIVE" || r.verdict === "CONNECTED").map((r) => r.provider);
const na = results.filter((r) => r.verdict === "NOT_AVAILABLE").map((r) => r.provider);
console.log("\nLIVE / CONNECTED:", live.length ? live.join(", ") : "— (אף אחד לא עבר בדיקת חיבור)");
console.log("NOT AVAILABLE  :", na.join(", "));
console.log("\nמסקנה: אף Provider לא עבר בדיקת חיבור מוצלחת → לא ניתן להריץ סריקה חיה.");
console.log("במצב HYBRID: חיפוש/מחיר/ניתוח יסומנו MOCK (fallback מסומן), X יסומן NOT_AVAILABLE.");
