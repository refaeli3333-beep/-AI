import { describe, it, expect } from "vitest";
import { normalizeUrl, contentHash, dedupe } from "../dedupe";
import { SearchResult } from "../../providers/types";

const mk = (url: string, title = "t", snippet = "s"): SearchResult => ({
  provider: "x", query: "q", title, url, domain: "", snippet, publishedAt: null, discoveredAt: "",
});

describe("dedupe", () => {
  it("normalizes trackers, www and trailing slash", () => {
    expect(normalizeUrl("https://www.Example.com/a/?utm_source=x#h")).toBe("https://example.com/a");
  });
  it("hashes identical content the same, different content differently", () => {
    expect(contentHash("A", "B")).toBe(contentHash("a", "b"));
    expect(contentHash("A", "B")).not.toBe(contentHash("A", "C"));
  });
  it("removes duplicate URLs (independent of content)", () => {
    const out = dedupe([mk("https://x.com/1", "a", "1"), mk("https://x.com/1/", "b", "2"), mk("https://x.com/2", "c", "3")]);
    expect(out.length).toBe(2);
  });
  it("removes duplicate content under different URLs", () => {
    const out = dedupe([mk("https://a.com/x", "same", "body"), mk("https://b.com/y", "same", "body")]);
    expect(out.length).toBe(1);
  });
  it("is idempotent across runs via shared seen sets", () => {
    const u = new Set<string>(), h = new Set<string>();
    dedupe([mk("https://x.com/1")], u, h);
    const second = dedupe([mk("https://x.com/1")], u, h);
    expect(second.length).toBe(0);
  });
});
