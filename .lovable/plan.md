

## Queue Architecture for Signal Execution

### Problem
`EdgeRuntime.waitUntil()` silently dies on complex searches (many keywords × multiple sources). The container gets recycled before the work finishes, leaving the run stuck as "running" forever.

### Solution
Move all signal execution out of `waitUntil()` and into a queue-worker pattern. The execute endpoint just enqueues the job; a separate cron-triggered worker picks it up and processes it with retries.

```text
User clicks "Run Signal"
  → signal-planner sets status = "queued", returns immediately
  → pg_cron (every 2 min) calls process-signal-queue
  → Worker picks up queued/stale runs, processes them
  → If it fails/times out, retry_count increments (max 3)
  → After 3 failures, marks as "failed" with notification
```

### Database Changes

Add columns to `signal_runs`:
- `started_at TIMESTAMPTZ` — when the worker started processing (for stale detection)
- `retry_count INTEGER DEFAULT 0` — tracks retry attempts
- `error_message TEXT` — stores failure reason for debugging

### Edge Function Changes

**`supabase/functions/signal-planner/index.ts`**
- Remove `EdgeRuntime.waitUntil()` call entirely
- In execute_signal handler: just set `status = "queued"` and return `{ status: "queued" }`
- Keep `handleExecuteSignal()` function but don't call it here anymore

**`supabase/functions/process-signal-queue/index.ts`** (new function, replaces process-daily-signals)
- Combines two responsibilities:
  1. Process **queued** runs (new on-demand signals)
  2. Process **scheduled** runs (daily/weekly signals that are due)
- Job leasing: `UPDATE signal_runs SET status='running', started_at=now() WHERE status='queued' OR (status='running' AND started_at < now() - interval '10 minutes' AND retry_count < 3) LIMIT 1`
- On success: set `status='completed'`
- On failure: increment `retry_count`, set `status='queued'` if retries remain, else `status='failed'` + send notification
- Contains the full execution logic (moved from signal-planner's `handleExecuteSignal`)

**Delete `supabase/functions/process-daily-signals/index.ts`** — consolidated into the new function.

### Cron Job
Set up pg_cron to call `process-signal-queue` every 2 minutes:
```sql
SELECT cron.schedule('process-signal-queue', '*/2 * * * *', ...);
```

### UI Changes

**`src/components/leads/SignalScraperTab.tsx`**
- Add "queued" to `StatusBadge` (blue pulsing badge)
- Update stale detection: check `started_at` instead of `created_at` for "running" status
- Show retry count in history item when > 0
- Poll every 5s when any run is "queued" or "running"

**`src/hooks/useSignalScraper.ts`**
- Update polling to also trigger on `status === 'queued'`
- Add `started_at`, `retry_count`, `error_message` to `SignalRun` type

### Files Summary

| File | Action |
|------|--------|
| `signal_runs` table | Add `started_at`, `retry_count`, `error_message` columns |
| `supabase/functions/signal-planner/index.ts` | Remove waitUntil, set status="queued" on execute |
| `supabase/functions/process-signal-queue/index.ts` | New worker: processes queued + scheduled runs with retries |
| `supabase/functions/process-daily-signals/index.ts` | Delete (consolidated) |
| `supabase/config.toml` | Add process-signal-queue, remove process-daily-signals |
| `src/components/leads/SignalScraperTab.tsx` | Add queued badge, retry count display |
| `src/hooks/useSignalScraper.ts` | Update types and polling |
| pg_cron job (via insert tool) | Schedule every 2 minutes |

