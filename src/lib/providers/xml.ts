/** Minimal RSS/Atom reader. No dependency, no invented fields: a missing date stays null. */
export interface FeedItem { title: string; link: string; description: string; pubDate: string | null; }

const ENTITIES: [RegExp, string][] = [
  [/&lt;/g, "<"], [/&gt;/g, ">"], [/&quot;/g, '"'],
  [/&#39;/g, "'"], [/&apos;/g, "'"], [/&nbsp;/g, " "], [/&amp;/g, "&"],
];

const strip = (s: string) => {
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");
  // Feed descriptions carry HTML-escaped markup (&lt;b&gt;), so decoding entities can
  // reveal a second layer of tags — strip again afterwards or they leak into the text.
  for (const [re, ch] of ENTITIES) out = out.replace(re, ch);
  out = out.replace(/<[^>]+>/g, " ");
  return out.replace(/\s+/g, " ").trim();
};

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? strip(m[1]) : "";
}

function isoOrNull(raw: string): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function parseFeed(xml: string, limit = 25): FeedItem[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];
  const out: FeedItem[] = [];
  for (const b of blocks.slice(0, limit)) {
    // Atom uses <link href="…"/>; RSS uses <link>…</link>.
    const hrefMatch = b.match(/<link[^>]*href="([^"]+)"/i);
    const link = hrefMatch ? hrefMatch[1] : tag(b, "link");
    const title = tag(b, "title");
    if (!link || !title) continue;
    out.push({
      title,
      link,
      description: tag(b, "description") || tag(b, "summary") || tag(b, "content"),
      pubDate: isoOrNull(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")),
    });
  }
  return out;
}
