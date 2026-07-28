import { WebSearchProvider, SearchResult, SearchOptions } from "./types";
import { dedupe } from "../search/dedupe";
import { scoreSource } from "../search/sourceScore";

// Runs a query across many providers, merges, de-duplicates, and ranks by source score.
// Providers that error out are skipped (the run never crashes on one bad provider).
export class AggregatedSearchService {
  constructor(private providers: WebSearchProvider[]) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const batches = await Promise.all(
      this.providers.map(async (p) => {
        try {
          const q = await p.getQuotaStatus();
          if (q.exhausted) return []; // skip exhausted provider, keep the rest working
          return await p.search(query, options);
        } catch { return []; }
      }),
    );
    const merged = dedupe(batches.flat());
    return merged.sort((a, b) => scoreSource(b.domain).score - scoreSource(a.domain).score);
  }

  async health() {
    return Promise.all(this.providers.map((p) => p.healthCheck()));
  }
}
