

## Fix: Stale Signal Detection + Stuck Run Recovery

### Problem
The queue worker's stale detection query:
```
status.eq.running,started_at.lt.${staleThreshold},retry_count.lt.3
```
...fails to match runs where `started_at IS NULL`. Two of three stuck runs have this condition (created by old code before queue architecture). They will remain stuck forever.

Additionally, the third run will keep timing out because complex multi-keyword searches exceed the edge function's runtime limit even with the 5-minute per-call timeout — the total wall-clock time across all keywords exceeds the edge function's ~60s container lifecycle.

### Changes

**1. `supabase/functions/process-signal-queue/index.ts`** — Fix stale detection query

Update the `.or()` filter to also match runs where `started_at` is null:
```
status.eq.queued,
and(status.eq.running,started_at.is.null),
and(status.eq.running,started_at.lt.${staleThreshold},retry_count.lt.${MAX_RETRIES})
```

This ensures any "running" run with no `started_at` is always picked up.

**2. `supabase/functions/process-signal-queue/index.ts`** — Process one run per invocation

Currently the worker loops through up to 5 runs. Since each complex run can have 6+ keywords × multiple sources, a single run can exhaust the function's wall-clock time. Change to process only **1 run per invocation** (the cron fires every 2 minutes, so throughput is still good). This prevents one long run from blocking others.

- Change `.limit(5)` to `.limit(1)` for queued runs
- Change `.limit(5)` to `.limit(1)` for scheduled runs  
- Process only the first available run

**3. Immediate fix for the 3 stuck runs**

Run a migration to reset the 3 stuck runs back to "queued" so the worker picks them up:
```sql
UPDATE signal_runs 
SET status = 'queued', started_at = NULL, retry_count = 0 
WHERE status = 'running' AND leads_discovered = 0;
```

### Files

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Fix stale query to handle NULL `started_at`; limit to 1 run per invocation |
| Database migration | Reset stuck runs to "queued" |

