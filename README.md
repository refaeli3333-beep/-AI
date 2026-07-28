# MARKET RADAR AI — full project (Next.js + Supabase)

**SIMULATION ONLY.** No real trading, no buy/sell, no broker, no profit guarantees.
All demo data is clearly labelled. A Google hit is only a pointer to a source — the
original source must still be opened and verified.

## What's here
- **Providers** (`src/lib/providers`) — a unified `WebSearchProvider` interface with:
  `GoogleProgrammableSearchProvider` (Google Custom Search JSON API), `MockSearchProvider`
  (offline/demo), and `Gdelt/Rss/Official` stubs. `AggregatedSearchService` merges,
  de-duplicates and ranks results across providers.
- **Search logic** (`src/lib/search`) — smart budgeted `queryBuilder`, `dedupe`
  (URL normalization + content hash), `sourceScore` (credibility 10–100), `quota` tracker.
- **Analysis** (`src/lib/analysis`) — `simulate` ($200 math + reaction metrics) and
  `investigate` (supply-chain candidate scoring: opportunity / risk / confidence).
- **Job** (`src/lib/jobs/scanInfluentialPeople.ts`) — the every-30-minutes scan,
  idempotent (no duplicate URL / content / quote / signal across runs).
- **API** — `POST /api/providers/test` (real health check, never reveals keys) and
  `GET /api/cron/scan` (protected by `CRON_SECRET`).
- **DB** — `supabase/migrations/0001_init.sql` (core + search/scan tables).
- **Tests** — Vitest specs plus a dependency-free `scripts/verify.mjs`.

## Setup
```bash
npm install
cp .env.example .env.local     # fill in keys (all optional to boot)
# create Supabase project, run the SQL:
#   supabase db push   (or paste supabase/migrations/0001_init.sql into the SQL editor)
npm run dev
```

## Verify the logic without any keys
```bash
npm run verify   # runs scripts/verify.mjs — 21 core checks, no network, no deps
npm run test     # full Vitest suite (after npm install)
```

## Adding the Google keys
1. Create a Google Cloud project, enable **Custom Search API**, create an API key.
2. Create a **Programmable Search Engine**, copy its **Search engine ID (cx)**.
3. Put them in `.env.local`:
   ```
   GOOGLE_SEARCH_API_KEY=your_key
   GOOGLE_SEARCH_ENGINE_ID=your_cx
   GOOGLE_DAILY_QUOTA=100
   APP_MODE=HYBRID
   ```
4. Keys live only in env — never in code, never shown in the UI, never stored as plain text.

## Test the connection
```bash
curl -X POST localhost:3000/api/providers/test -H 'content-type: application/json' \
  -d '{"provider":"GoogleProgrammableSearchProvider"}'
```
Returns `{ connected, missingEnvKeys, message }`. It shows `connected: true` **only**
after one real query succeeds. If keys are missing it stays `Not Connected`.

## The 30-minute scan
- Schedule: `vercel.json` → `*/30 * * * *` calling `/api/cron/scan`.
- Locally trigger once:
  ```bash
  curl "localhost:3000/api/cron/scan?secret=$CRON_SECRET"
  ```
- The job loads active people (ordered by importance), builds budgeted queries per
  priority (high=5, medium=2, low=1), searches, de-duplicates, scores sources, and
  creates a signal only when a possible market meaning is found. Strong signals (score ≥ 80)
  emit an internal alert.

## Modes (never show demo as live)
- `APP_MODE=DEMO` — Mock provider only.
- `APP_MODE=HYBRID` — real providers + Mock fallback.
- `APP_MODE=LIVE` — real providers; only real-sourced records are shown.

## Not run in this environment
`npm install`, `npm run build`, and live Google calls were **not** executed where this
package was generated (no network). `scripts/verify.mjs` (21 checks) was run and passes.
Run `npm install && npm run build && npm run test` locally to complete the checks.

---

## Live pipeline (v0.3)
A new statement now becomes a full signal automatically:

```
search result → fetchSource() → extract + verify → detect direct quote →
translateToHebrew() → analyzeStatement() → mapAssets() (sectors→companies→tickers) →
market.getPriceAtTimestamp() → scoreCandidate() (opportunity/risk/confidence) →
createSignal + signal_assets + price milestones (future = Pending) → alert
```

- **`createSignalIfMeaningful`** (`src/lib/pipeline/createSignal.ts`) is fully wired and
  called by the cron route. It rejects items with no market meaning and returns a
  `SignalCreationResult` with a rejection reason, evidence count, mapped-asset count and
  data-completeness percent.
- **Market data**: `PolygonMarketDataProvider` (real) behind the `MarketDataProvider`
  adapter, with `MockMarketDataProvider` for DEMO / missing key. Out-of-hours publications
  store last close + next open and are not shown as an immediate regular-session move.
- **Every record is tagged** `news_source` / `price_source` / `analysis_source` = LIVE|MOCK,
  plus a **Data Completeness Score** (100% = real source + full text + exact time + real
  price + real analysis; otherwise it lists exactly what's missing).

### Extra env for this stage
```
MARKET_DATA_PROVIDER=polygon
MARKET_DATA_API_KEY=your_polygon_key
TRANSLATION_API_KEY=your_google_translate_key   # optional
AI_API_KEY=your_llm_key                          # optional; heuristic used if absent
APP_MODE=HYBRID
```

### Verify without keys/network
```bash
npm run verify              # 21 core-logic checks
npm run verify:integration  # 21 end-to-end pipeline checks (offline, deterministic)
```
Both pass with plain node. `npm run test` (Vitest) and `npm run build` require `npm install`
and were **not** executed where this package was generated (no network) — do not assume they
passed until you run them locally.

---

## Economic Impact Investigation Engine (v0.4)
`src/lib/impact/engine.ts` turns a statement into WHO may actually earn revenue, by
traversing a curated knowledge graph (`knowledgeBase.ts` + `knowledgeGraph.ts`):

```
event → economic need → technologies → components → companies →
supply-chain edges (hidden suppliers) → possible losers
```

- Returns structured JSON: directMeaning, hiddenMeaning, possibleIntent, economicNeed,
  requiredTechnologies, requiredComponents, affectedSectors, directBeneficiaries,
  indirectBeneficiaries, hiddenSuppliers, possibleLosers, evidence, assumptions,
  confirmationTriggers, invalidationTriggers, confidenceScore, riskScore, valueChain,
  and up to **5 ranked companies** (direct beneficiary / critical component supplier /
  hidden supplier / not-yet-reacted / possible loser).
- Every company carries an **explanation + evidence** (real IR/product URLs). No company
  is emitted without evidence; with no match it returns *"אין כרגע מספיק ראיות…"*.
- Wired into `createSignalIfMeaningful` and persisted to `event_needs` /
  `event_company_impacts` / `impact_evidence` (migration `0002_impact.sql`).
- The demo's signal-detail screen shows a **"מה מסתתר מאחורי האירוע"** section
  (problem → need → technology → components → value chain → companies).

### Offline verification (no keys/network)
```bash
npm run verify             # 21 core-logic checks
npm run verify:integration # 21 pipeline checks
npm run verify:impact      # 14 impact-engine checks
```
All 56 pass with plain node. `npm run test` (Vitest) and `npm run build` require
`npm install` and were not executed here.

---

## Smart Scan Command (v0.5)
A natural-language command bar drives an on-demand scan.

- **`NaturalLanguageScanCommandEngine`** (`src/lib/command/nlCommand.ts`) parses free
  Hebrew into a structured `ScanCommand` (people + aliases, source types, canonical topics,
  and a timezone-aware date range). Understands: היום · מהבוקר · 24 השעות האחרונות · אתמול ·
  השבוע האחרון / 7 ימים · החודש / 30 ימים. Times resolve to absolute UTC.
- **Runner** (`src/lib/command/runner.ts`) picks providers by mode/source, searches within
  the requested people + range, de-dupes, runs the full signal pipeline, and reports live
  progress across 10 stages. When tweets are requested but X isn't connected it says so and
  never fabricates tweets.
- **API**: `POST /api/scan-command` → `{ parsedCommand, runId, status }`;
  `GET /api/scan-command/:runId` → `{ status, progress, stage, results, errors }`.
- **DB**: `scan_commands` + `scan_command_results` (migration `0003_scan_commands.sql`).
- **Demo UI**: command bar at the top of the main screens with סרוק עכשיו / מיקרופון /
  נקה / חיפושים אחרונים, quick-range chips (היום/24 שעות/7 ימים/30 ימים), example commands,
  a live progress overlay, a results screen, command history (re-runnable), and voice input
  via the Web Speech API (hidden when unsupported).

### Offline verification
```bash
npm run verify:command   # 12 NL-parser checks (Hebrew, today, last-week, 24h, people, topics)
```
Total offline checks now: **68** (verify 21 + integration 21 + impact 14 + command 12), all passing with plain node.

---

## HYBRID wiring (v0.6) — command bar connected to the internal API
The dashboard command bar (`src/app/page.tsx`) is wired to the **real internal endpoint**:
`POST /api/scan-command` → `runId`, then it polls `GET /api/scan-command/:runId` for live
progress and results. The POST route:

1. parses the command (`parseScanCommand`);
2. resolves people **alias-aware** (full_name / original-language name / aliases);
3. starts a **scan_run** and inserts a `scan_commands` row (status=running);
4. the runner picks providers by mode, searches the requested people + date range,
   de-dupes, and for each result runs **`createSignalIfMeaningful`** →
   **`EconomicImpactInvestigationEngine`** (need → technologies → components → companies →
   hidden suppliers) → market prices → milestones (signal/h1/h3/d1/d3/d7/d30) → **$200**;
5. persists `signals`, `signal_assets`, `event_company_impacts`, `impact_evidence`,
   `price_snapshots`, and updates `scan_commands` + `scan_command_results` on completion;
6. tags every result **LIVE / MOCK / NOT_AVAILABLE** and reports **missing API keys**.

### Running the exact command
```
"תסרוק עכשיו את כל הציוצים והאמירות של אילון מאסק, טראמפ ובנימין נתניהו מהשבוע האחרון
 ותראה אילו חברות יכולות להרוויח ולמה"
```
Offline e2e (`npm run e2e`) runs this exact command through the full flow and shows:
3 people → 3 signals → ranked companies incl. hidden suppliers → h1/h3/d1/d7 prices → $200.

### What is LIVE vs MOCK here
With no API keys / no network in this environment, **HYBRID falls back to Mock** for search,
price and analysis, and **X is NOT_AVAILABLE**. Missing keys reported by the run:
`GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID, MARKET_DATA_API_KEY, X_API_BEARER_TOKEN,
TRANSLATION_API_KEY, AI_API_KEY`. Add them + `APP_MODE=HYBRID` to turn each source LIVE.

### Build/test status in this environment
`npm install` is blocked here (no registry access → 403), so `npm run test` and
`npm run build` were **not executed**. All dependency-free suites pass:
`verify` 21 · `verify:integration` 21 · `verify:impact` 14 · `verify:command` 12 · `e2e` 8
= **76 checks**. Run `npm install && npm run test && npm run build` locally to finish.

---

## HYBRID transition + LIVE attempt (v0.7) — honest status
`APP_MODE` default moved to **HYBRID**. LIVE tagging was tightened: a source is marked
`LIVE` **only after a successful `healthCheck()`**, never on key presence
(`npm run live:check` performs the real connection probes).

**In THIS environment a full LIVE run is not possible** and was not faked:
- `npm install` → **HTTP 403** (npm registry blocked) → `npm run test` / `npm run build`
  could not run.
- Real connection probes to every provider (actual `fetch`): Google 403 · Market 403 ·
  X 403 · Translation 403 · AI 401 · Supabase 403 → **all NOT_AVAILABLE**.
- All six API keys and both Supabase vars are **empty**.

Therefore, in HYBRID here: search / price / analysis fall back to **MOCK (clearly marked)**,
X is **NOT_AVAILABLE**, and no source is labelled LIVE. To go LIVE, run locally with network,
add the keys to `.env.local`, run `npm run live:check` (must show LIVE/CONNECTED), apply the
SQL migrations to Supabase, then run the scan command.

Offline coverage (no network/keys): verify 21 · integration 21 · impact 14 · command 12 ·
e2e 8 = **76 checks passing**.
