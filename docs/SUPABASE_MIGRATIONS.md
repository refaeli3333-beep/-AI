# Supabase migrations — current state and how to apply them

## Verified state (checked live against the configured project)

The Supabase project **is reachable** with the configured service-role key
(`GET /rest/v1/` returns the PostgREST OpenAPI document, HTTP 200), but the
**`public` schema is empty — no migration has ever been applied**. Every table probe
returns `PGRST205 Could not find the table 'public.<name>' in the schema cache`,
including `signals`, `influential_people`, `provider_connections`, `conclusions`,
`agent_results`, `observations` and `lessons_learned`.

Consequences while this is true:

- Scans run and return real results, but **nothing is persisted**.
- The research room produces conclusions, but **nothing is learned across runs** —
  `memory.persisted` comes back `false` and the UI says so instead of implying otherwise.
- `provider_reliability` and `prediction_results` stay empty, so the confidence model
  treats provider reliability as neutral (0.5) and historical accuracy as unknown (`null`).

## Why this was not applied for you

Applying these files is **DDL**, which PostgREST cannot execute. It needs one of:

- the Supabase **SQL Editor** in the dashboard (browser session), or
- the **Postgres connection string with the database password**, or
- the **Supabase CLI with a personal access token**.

None of those credentials are present in this repository or its environment, and the
service-role key alone cannot create tables. The migrations were therefore **left
unapplied on purpose** rather than worked around.

## A separate configuration bug that was fixed in code

`SUPABASE_URL` in `.env.local` is set to `https://<project-ref>.supabase.co/rest/v1/`.
`supabase-js` appends `/rest/v1` itself, so every query was being sent to
`/rest/v1/rest/v1/<table>` and failing with `PGRST125 Invalid path specified in request URL`
— silently, because the client code treats a DB error as "no data yet".

`src/lib/db.ts` now normalises this (`normalizeSupabaseUrl`), so both forms work. Setting
`SUPABASE_URL` to the project root (`https://<project-ref>.supabase.co`) is still the
correct value and is what `.env.example` documents.

## How to apply (safe, additive, idempotent)

Open the Supabase dashboard → **SQL Editor**, and run these files **in order**:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_impact.sql`
3. `supabase/migrations/0003_scan_commands.sql`
4. `supabase/migrations/0005_agent_memory.sql`

(There is no `0004`.)

Or, with the database password available:

```bash
psql "$SUPABASE_DB_URL" \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_impact.sql \
  -f supabase/migrations/0003_scan_commands.sql \
  -f supabase/migrations/0005_agent_memory.sql
```

### Safety review of `0005_agent_memory.sql`

Audited statement by statement: **15 × `create table if not exists`** and **1 ×
`create extension if not exists "pgcrypto"`**. There is no `DROP`, no `TRUNCATE`, no
`DELETE`, and no `ALTER` of an existing table. The only `on delete cascade` occurrences
anywhere in `supabase/migrations/` are inside foreign-key column definitions in 0001–0003,
which describe referential integrity — they are not destructive statements.

The file is therefore additive, non-destructive, and safe to run repeatedly.

### What it preserves

`observations`, `memory_events`, `memory_sources`, `memory_entities`, `claims`,
`hypotheses`, `agent_results`, `contradictions`, `conclusions`, `confidence_history`,
`prediction_results`, `provider_reliability`, `source_reliability`, `lessons_learned`,
`agent_performance`.

## After applying

The home screen's **זיכרון** indicator flips to "פעיל", and `/api/radar-brain` starts
reporting `memory.persisted: true` with the list of tables actually written. No code
change or redeploy is required — the check is performed live on each request.
