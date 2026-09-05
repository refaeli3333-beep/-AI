# Background radar — what actually runs, and what does not

This file exists so nobody reads "background radar" as "the agents are learning all the time".
They are not. They learn only while a scan is actually executing.

## What is scheduled today

`vercel.json` declares one cron job:

| Path | Schedule | Auth |
|---|---|---|
| `/api/cron/scan` | `0 6 * * *` (once a day, 06:00 UTC) | `Authorization: Bearer $CRON_SECRET` |

That is the **maximum cadence the Vercel Hobby plan allows** — Hobby cron jobs run at most
once per day, and the plan permits at most two of them. The schedule above is therefore not
a design preference; it is the ceiling of the current hosting plan.

Vercel sends the `Authorization: Bearer $CRON_SECRET` header automatically when `CRON_SECRET`
is set as a project environment variable. The variable exists in the Vercel project but its
**value is empty**, which was verified in production: `/api/cron/scan` answered `200` both
with no `Authorization` header and with a deliberately wrong one.

The endpoint now **fails closed**. With `CRON_SECRET` unset or empty it answers `503`
(`cron_not_configured`) instead of running, and with a wrong secret it answers `401`. Until a
real value is set in the Vercel project settings the daily scan will not run — that is
deliberate: an endpoint that spends provider quota and writes to Supabase must not be open.

## What this means honestly

- The radar scans **once per day**, not continuously.
- Between runs, no agent is investigating anything. Nothing is learned while the app merely sits deployed.
- A machine being switched on has no effect at all: the schedule lives in Vercel, not on any laptop.
- `lastSyncAt` on the home screen is written only after a sync that really returned data, so a
  stale timestamp is the truth, not a display bug.

## What more frequent scanning would require

Sub-daily autonomous scanning is a **hosting change, not a code change**. The scan endpoint is
already idempotent and secret-protected, so any of these can drive it as often as wanted:

1. **Vercel Pro** — unlocks minute-level cron schedules; only `vercel.json` changes.
2. **An external scheduler** — GitHub Actions `schedule`, cron-job.org, Upstash QStash, or a
   small always-on host, each issuing:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<deployment>/api/cron/scan`
3. **A worker process** on an always-on host (Fly.io, Railway, a VPS) calling the same endpoint.

Until one of those is set up, the correct description of this system is: **a daily scheduled
scan plus on-demand scans triggered from the UI.** This repository does not simulate anything
more frequent.
