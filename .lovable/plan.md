

## Fix: Container-Kill-Proof Retry Mechanism

### Root Cause
When the edge function container is killed by the platform (timeout/memory), the `catch` block never runs. This means `retry_count` never increments, creating an infinite stale-detect → re-lease → kill loop.

### Solution
Move the retry-count increment into the **lease step itself**, not the catch block. If the worker picks up a "running" (stale) run, that IS the evidence of a failed attempt — increment retry_count at lease time.

### Changes

**`supabase/functions/process-signal-queue/index.ts`**

In the job leasing section (~line 307-320), change the lease logic:

```text
For each run picked up:
  - If run.status === "running" (stale recovery):
    → increment retry_count in the lease update
    → if retry_count + 1 >= MAX_RETRIES, mark as "failed" immediately, notify user, skip
  - If run.status === "queued" (fresh job):
    → lease normally (no retry increment)
```

Specifically:
1. When leasing a stale run, set `retry_count: (run.retry_count || 0) + 1` in the update
2. Before processing, check if the new retry_count >= MAX_RETRIES. If so, mark failed + notify + skip
3. Keep the catch block as a secondary safety net (for non-timeout errors), but don't double-increment

Also fix the completed-with-0-leads issue: in `processSignalRun`, ensure that runs which return 0 results from Apify still get properly marked as completed (this path appears to work already, so likely that second run was a victim of the old `waitUntil` code before the migration reset it).

### Files

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Increment retry_count at lease time for stale runs; fail immediately at MAX_RETRIES |
| Database migration | Reset the currently stuck run back to queued |

