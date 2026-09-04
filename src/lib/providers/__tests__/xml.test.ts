import { describe, it, expect } from "vitest";
import { parseFeed } from "../xml";
import { normalizeSupabaseUrl } from "../../db";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title><![CDATA[Nvidia &amp; AMD rally]]></title>
    <link>https://example.com/a</link>
    <description>Chips move on &lt;b&gt;AI&lt;/b&gt; demand</description>
    <pubDate>Wed, 03 Sep 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>No date here</title>
    <link>https://example.com/b</link>
    <description>Something</description>
    <pubDate>not a date</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Atom item</title><link href="https://example.org/x"/><summary>Summary text</summary><updated>2026-09-01T08:00:00Z</updated></entry>
</feed>`;

describe("parseFeed", () => {
  it("reads RSS items, unwraps CDATA and decodes entities", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Nvidia & AMD rally");
    expect(items[0].link).toBe("https://example.com/a");
    expect(items[0].description).toBe("Chips move on AI demand");
    expect(items[0].pubDate).toBe("2026-09-03T10:00:00.000Z");
  });

  it("leaves an unparseable date as null rather than inventing one", () => {
    expect(parseFeed(RSS)[1].pubDate).toBeNull();
  });

  it("reads Atom entries with href links", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe("https://example.org/x");
    expect(items[0].description).toBe("Summary text");
  });

  it("respects the limit and skips items without a link or title", () => {
    expect(parseFeed(RSS, 1)).toHaveLength(1);
    expect(parseFeed("<rss><channel><item><title>x</title></item></channel></rss>")).toHaveLength(0);
  });
});

describe("normalizeSupabaseUrl", () => {
  it("strips a REST path so supabase-js does not build /rest/v1/rest/v1", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1")).toBe("https://abc.supabase.co");
  });
  it("leaves a correct root url untouched", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });
});
