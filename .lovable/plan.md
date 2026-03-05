

## Why LinkedIn Runs Show "Failed" — and How to Fix It

### Root Cause

The `phaseScraping` function polls Apify runs but has **no per-run timeout**. When a LinkedIn actor run hangs (stays `RUNNING` on Apify's side indefinitely — common with residential proxy scrapes), the entire signal run just keeps polling every 2 minutes until the 60-minute hard ceiling is hit. At that point, the run is marked stale, reset, retried, and after 3 attempts marked `failed`.

The problem is not LinkedIn-specific — any actor that hangs on Apify's side will cause the same behavior. LinkedIn is just the most prone because residential proxies add latency and LinkedIn rate-limits aggressively.

### Fix Plan

**File: `supabase/functions/process-signal-queue/index.ts`**

1. **Add per-run timeout in `phaseScraping`** — If an individual Apify run has been `RUNNING` for more than 15 minutes, abort it via the Apify API and mark it `TIMED-OUT`. This prevents one slow actor from dragging the entire signal run to the hard ceiling.

2. **Track per-run start time** — Add a `startedAt` timestamp to each `ApifyRunRef` when the run is created in `phaseStarting`. This gives `phaseScraping` a way to know how long each individual run has been going.

3. **Add an `abortApifyRun` helper** — Call `POST /v2/actor-runs/{runId}/abort` to cleanly stop hung runs on Apify's side (avoids wasting Apify compute credits too).

4. **Treat partial success as success** — When moving from scraping → collecting, proceed even if some runs failed/timed-out (current code already does this since it filters for `SUCCEEDED` refs). But add a log line showing how many succeeded vs failed so the user can see the breakdown.

5. **Apply to all actors** — The per-run timeout applies universally, not just LinkedIn. This makes Google Maps, Indeed, and Yelp actors resilient to the same hang scenario.

### Changes Summary

```text
ApifyRunRef interface:
  + startedAt: string  (ISO timestamp, set when run is created)

phaseStarting():
  Set ref.startedAt = new Date().toISOString() for each new run

phaseScraping():
  For each RUNNING ref:
    if (Date.now() - ref.startedAt > 15 min):
      call abortApifyRun(ref.runId)
      ref.status = "TIMED-OUT"

New helper:
  abortApifyRun(runId, token) → POST /v2/actor-runs/{runId}/abort
```

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Add per-run 15-min timeout, `startedAt` tracking, `abortApifyRun` helper |

