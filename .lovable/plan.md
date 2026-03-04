

## Fix the Real Bottleneck: Async Apify Execution

### Problem
The edge function calls Apify's `run-sync-get-dataset-items` endpoint, which blocks until the scrape finishes. LinkedIn scrapes take 3-10 minutes. The edge function container is killed at ~60 seconds. Every run fails, every time. Retries just repeat the same timeout.

### Solution: Split into Start → Poll → Collect

Replace the single synchronous call with a 3-phase state machine that spans multiple cron invocations:

```text
Phase 1 (Invocation 1): START actor run via async API → store Apify run ID → set status "scraping"
Phase 2 (Invocation 2+): POLL Apify for run status → if not done, return (wait for next cron)
Phase 3 (When done): COLLECT dataset items → normalize → deduplicate → store leads → mark completed
```

Each phase takes <5 seconds of edge function time. The Apify actor runs independently on Apify's infrastructure for as long as it needs.

### Database Changes

Add columns to `signal_runs`:
- `apify_run_ids JSONB DEFAULT '[]'` — array of `{ actorKey, keyword, runId, status }` tracking each Apify run
- `processing_phase TEXT DEFAULT 'pending'` — one of: `pending`, `starting`, `scraping`, `collecting`, `scoring`
- `current_keyword_index INTEGER DEFAULT 0` — tracks which keyword we're on during the start phase

### Edge Function Changes (`process-signal-queue/index.ts`)

**Replace `processSignalRun` with a state machine:**

1. **Phase: `pending` / `starting`** — For each keyword in the plan, call Apify's async start endpoint (`POST /v2/acts/{actorId}/runs`) which returns immediately with a `runId`. Store each `runId` in `apify_run_ids`. If there are many keywords, start a batch per invocation (e.g., 3 at a time) and advance `current_keyword_index`. Once all keywords are started, set phase to `scraping`.

2. **Phase: `scraping`** — For each stored `runId`, call `GET /v2/actor-runs/{runId}` to check status. If any run is still going (`RUNNING`, `READY`), return early and wait for next cron cycle. If all runs are `SUCCEEDED`, move to `collecting`. If any `FAILED`/`TIMED-OUT`, log it and continue with the rest.

3. **Phase: `collecting`** — For each completed `runId`, fetch results via `GET /v2/datasets/{datasetId}/items`. Normalize, deduplicate, store leads. Mark run as `completed`.

**Key API endpoints:**
- Start: `POST https://api.apify.com/v2/acts/{actorId}/runs?token=...` (body: input JSON) — returns `{ data: { id: "runId", defaultDatasetId: "..." } }`
- Poll: `GET https://api.apify.com/v2/actor-runs/{runId}?token=...` — returns `{ data: { status: "RUNNING|SUCCEEDED|FAILED" } }`
- Collect: `GET https://api.apify.com/v2/datasets/{datasetId}/items?token=...` — returns array of results

**Worker loop change:** The worker query must also pick up runs with `status = 'running'` and `processing_phase IN ('starting', 'scraping', 'collecting')` — these are actively progressing, not stale. Only runs with `processing_phase = NULL` or `pending` that have been running for >10 min are truly stale.

### Stale Detection Update

Runs in `scraping` phase are not stale — they're waiting for Apify. Update the stale detection to only flag runs where `processing_phase NOT IN ('scraping', 'starting', 'collecting')` or where `started_at` is older than 30 minutes (hard ceiling).

### Migration: Reset stuck runs

```sql
-- Add new columns
ALTER TABLE signal_runs ADD COLUMN IF NOT EXISTS apify_run_ids JSONB DEFAULT '[]';
ALTER TABLE signal_runs ADD COLUMN IF NOT EXISTS processing_phase TEXT DEFAULT 'pending';
ALTER TABLE signal_runs ADD COLUMN IF NOT EXISTS current_keyword_index INTEGER DEFAULT 0;

-- Reset the 2 stuck runs
UPDATE signal_runs 
SET status = 'queued', started_at = NULL, retry_count = 0, 
    processing_phase = 'pending', apify_run_ids = '[]', current_keyword_index = 0
WHERE status = 'running' AND leads_discovered = 0;
```

### Files

| File | Change |
|------|--------|
| `signal_runs` table | Add `apify_run_ids`, `processing_phase`, `current_keyword_index` columns |
| `supabase/functions/process-signal-queue/index.ts` | Replace synchronous Apify call with async start/poll/collect state machine |
| Database migration | Add columns + reset stuck runs |

### What stays the same
- Signal planner, plan generation, UI — all unchanged
- Normalization, dedup, credit charging logic — reused as-is, just called in the `collecting` phase
- AI classification block — stays in place, runs after collection
- Cron schedule (every 2 minutes) — perfect for polling

