import { SearchResult } from "../providers/types";

// Normalize a URL so trackers/casing/trailing slashes don't create false uniques.
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const strip = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","ref"];
    strip.forEach((k) => u.searchParams.delete(k));
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch { return raw.trim(); }
}

// Stable content hash (djb2) over normalized title+snippet — offline, deterministic.
export function contentHash(title: string, snippet: string): string {
  const text = `${title}\n${snippet}`.toLowerCase().replace(/\s+/g, " ").trim();
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Remove duplicates by normalized URL and by content hash. `seen*` carry prior state
// so repeated job runs are idempotent (no duplicate URL/content/quote/signal).
export function dedupe(
  results: SearchResult[],
  seenUrls = new Set<string>(),
  seenHashes = new Set<string>(),
): SearchResult[] {
  const out: SearchResult[] = [];
  for (const r of results) {
    const nurl = normalizeUrl(r.url);
    const hash = contentHash(r.title, r.snippet);
    if (!nurl || seenUrls.has(nurl) || seenHashes.has(hash)) continue;
    seenUrls.add(nurl); seenHashes.add(hash);
    out.push({ ...r, url: nurl });
  }
  return out;
}
