// Opens the original source found via search and extracts the real content.
// A search snippet is never treated as the source of truth.
export interface FetchedSource {
  canonicalUrl: string; title: string; author: string | null; language: string;
  rawText: string; extractedText: string; directQuotes: string[];
  publishedAt: string | null; fetchStatus: "ok" | "blocked" | "error" | "not_found";
  contentHash: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}
function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re); return m ? m[1] : null;
}
function detectLanguage(text: string): string {
  return /[\u0590-\u05FF]/.test(text) ? "he" : "en";
}
function extractQuotes(text: string): string[] {
  const out: string[] = [];
  const re = /["“”„»«]([^"“”„»«]{15,300})["“”„»«]/g;
  let m; while ((m = re.exec(text)) && out.length < 6) out.push(m[1].trim());
  return out;
}
function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); }

export async function fetchSource(url: string): Promise<FetchedSource> {
  const empty = (status: FetchedSource["fetchStatus"]): FetchedSource => ({
    canonicalUrl: url, title: "", author: null, language: "en", rawText: "", extractedText: "",
    directQuotes: [], publishedAt: null, fetchStatus: status, contentHash: "",
  });
  try {
    const res = await fetch(url, { headers: { "user-agent": "MarketRadarAI/0.3 (+source-verification)" } });
    if (res.status === 404) return empty("not_found");
    if (res.status === 403 || res.status === 401 || res.status === 429) return empty("blocked");
    if (!res.ok) return empty("error");
    const html = await res.text();
    const extractedText = stripHtml(html).slice(0, 8000);
    const title = meta(html, "og:title") || (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "").trim();
    return {
      canonicalUrl: meta(html, "og:url") || url,
      title,
      author: meta(html, "author") || meta(html, "article:author"),
      language: detectLanguage(extractedText),
      rawText: html.slice(0, 20000),
      extractedText,
      directQuotes: extractQuotes(extractedText),
      publishedAt: meta(html, "article:published_time") || meta(html, "og:updated_time"), // null if absent
      fetchStatus: "ok",
      contentHash: hash(extractedText),
    };
  } catch {
    return empty("error");
  }
}
