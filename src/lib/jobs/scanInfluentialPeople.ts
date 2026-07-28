import { AggregatedSearchService } from "../providers/aggregated";
import { GoogleProgrammableSearchProvider } from "../providers/google";
import { MockSearchProvider } from "../providers/mock";
import { GdeltProvider } from "../providers/gdelt";
import { RssProvider } from "../providers/rss";
import { OfficialProvider } from "../providers/official";
import { buildQueries, PersonForQuery, QUERY_BUDGET, Priority } from "../search/queryBuilder";
import { dedupe, normalizeUrl, contentHash } from "../search/dedupe";
import { scoreSource } from "../search/sourceScore";
import { getMode } from "../mode";
import { SearchResult } from "../providers/types";

export interface ScanDeps {
  loadActivePeople: () => Promise<PersonForQuery[]>;
  isKnownUrl: (url: string) => Promise<boolean>;         // dedup against DB
  isKnownHash: (hash: string) => Promise<boolean>;
  saveResult: (r: SearchResult & { personName: string; sourceScore: number }) => Promise<void>;
  createSignalIfMeaningful: (r: SearchResult, personName: string) => Promise<{ created: boolean; score?: number }>;
  emitAlert: (msg: string) => Promise<void>;
}

export interface ScanReport {
  provider: string; startedAt: string; completedAt: string; status: string;
  peopleScanned: number; queryCount: number; resultsFound: number; newResults: number;
  verifiedResults: number; signalsCreated: number; errorsCount: number;
}

// A simple in-process lock so two overlapping cron ticks don't run concurrently.
let RUNNING = false;

/**
 * scan_influential_people_every_30_minutes
 * Cron schedule: every 30 minutes. Idempotent: URL/content dedup means a double run
 * never stores the same link, article, quote or signal twice.
 */
export async function scanInfluentialPeople(deps: ScanDeps): Promise<ScanReport> {
  const startedAt = new Date().toISOString();
  const mode = getMode();
  const report: ScanReport = {
    provider: "AggregatedSearchService", startedAt, completedAt: startedAt, status: "running",
    peopleScanned: 0, queryCount: 0, resultsFound: 0, newResults: 0,
    verifiedResults: 0, signalsCreated: 0, errorsCount: 0,
  };

  if (RUNNING) { report.status = "skipped_locked"; report.completedAt = new Date().toISOString(); return report; }
  RUNNING = true;

  try {
    // choose providers by mode. DEMO → mock only; HYBRID/LIVE → real + mock fallback.
    const providers = mode === "DEMO"
      ? [new MockSearchProvider()]
      : [new GoogleProgrammableSearchProvider(), new GdeltProvider(), new RssProvider(), new OfficialProvider(), new MockSearchProvider()];
    const search = new AggregatedSearchService(providers);

    // 1-3) load people, sort by importance / priority, respect scan schedule
    let people = await deps.loadActivePeople();
    people = people.sort((a, b) => QUERY_BUDGET[(b.scan_priority || "medium") as Priority] - QUERY_BUDGET[(a.scan_priority || "medium") as Priority]);

    const seenUrls = new Set<string>();
    const seenHashes = new Set<string>();

    for (const person of people) {
      report.peopleScanned++;
      const queries = buildQueries(person); // 4) smart, budgeted queries
      for (const q of queries) {
        report.queryCount++;
        let results: SearchResult[] = [];
        try {
          results = await search.search(q.text, { language: q.language, freshnessHours: 24, maxResults: 5 });
        } catch { report.errorsCount++; continue; }
        report.resultsFound += results.length;

        // 5) keep only genuinely new results (idempotency across runs + within run)
        const fresh = dedupe(results, seenUrls, seenHashes);
        for (const r of fresh) {
          const nurl = normalizeUrl(r.url);
          const hash = contentHash(r.title, r.snippet);
          if (await deps.isKnownUrl(nurl) || await deps.isKnownHash(hash)) continue;

          report.newResults++;
          const src = scoreSource(r.domain);
          if (src.score >= 90) report.verifiedResults++;

          // 6-7) store raw result (source opening/verification happens downstream)
          await deps.saveResult({ ...r, url: nurl, personName: person.full_name, sourceScore: src.score });

          // 14-15) create a signal only if there is a possible market meaning; alert if strong
          const sig = await deps.createSignalIfMeaningful(r, person.full_name);
          if (sig.created) {
            report.signalsCreated++;
            if ((sig.score || 0) >= 80) await deps.emitAlert(`אות חזק (${sig.score}) עבור ${person.full_name}`);
          }
        }
      }
    }

    report.status = "completed";
  } catch (e) {
    report.status = "failed"; report.errorsCount++;
  } finally {
    RUNNING = false;
    report.completedAt = new Date().toISOString();
  }
  return report;
}
