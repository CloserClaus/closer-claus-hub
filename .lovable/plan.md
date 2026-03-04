

## Issues to Fix

### 1. Stuck "running" status
The `EdgeRuntime.waitUntil()` background execution can silently die (e.g., if Apify times out or an unhandled error occurs after the function container shuts down). The run stays in "running" forever. The logs show nothing for signal-planner, confirming the background process died silently.

**Fix**: Add a staleness check. In the `signal-runs` query or in the UI, detect runs that have been "running" for more than 10 minutes and auto-mark them as "failed". Also add a timeout wrapper around the Apify fetch calls.

### 2. Inaccurate cost estimates
The AI planner estimates `estimated_rows` for each source, but both a narrow query ("marketing agencies < 10 employees hiring SDR in 24h") and a broad query ("SaaS companies hiring SDRs") produce ~280 rows and ~10 credits. The AI has no real data to estimate from — it just guesses.

**Fix**: Replace the AI's arbitrary `estimated_rows` guess with a formula driven by concrete inputs:
- Count the number of keywords (from OR splitting)
- Multiply by the `maxResults` default for that actor
- Sum across all sources in the plan
- This gives a realistic upper bound instead of an AI hallucination

The credit formula then uses this realistic row count. The AI's `estimated_rows` becomes a suggestion that gets overridden by the formula.

### 3. Add "Run weekly" schedule option
Currently only "once" and "daily" exist.

**Fix**: Add "weekly" to the schedule type in the UI (use a radio group or 3-way toggle instead of a binary switch). Update the edge function to set `next_run_at` to +7 days for weekly. Update `process-daily-signals` to also pick up weekly signals.

---

## Changes

### `supabase/functions/signal-planner/index.ts`

**A. Realistic estimation** (in `handleGeneratePlan`, after plans are validated ~line 586):
- For each plan, count keywords by splitting `search_query` on ` OR `, multiply by the actor's default max results field value, and use that as the real `estimated_rows` instead of the AI's guess.

**B. Weekly schedule support** (in execute_signal handler ~line 477-479):
- Add `weekly` case: set `next_run_at` to `Date.now() + 7 * 86400000`.

**C. Stale run detection** — add a timeout wrapper around Apify calls (5 min per call via `AbortController`).

### `supabase/functions/process-daily-signals/index.ts`

- Change the query filter from `.eq("schedule_type", "daily")` to `.in("schedule_type", ["daily", "weekly"])`.
- When updating `next_run_at` after a weekly run, use +7 days instead of +1 day.

### `src/components/leads/SignalScraperTab.tsx`

- Change `scheduleType` state from `'once' | 'daily'` to `'once' | 'daily' | 'weekly'`.
- Replace the binary Switch with a 3-option selector (radio group or segmented buttons): "Run once", "Run daily", "Run weekly".
- In `SignalHistoryItem`, show "Weekly" badge for `schedule_type === 'weekly'`.
- Add stale run detection: if a run has been "running" for >10 minutes, show it as "Stale" with a retry button, and auto-update its status to "failed" in the DB.

### `src/hooks/useSignalScraper.ts`

- Update `SignalRun` type to include `schedule_type: string` (already there, just need `'weekly'` to be a valid value — no type change needed since it's already `string`).

| File | Summary |
|------|---------|
| `supabase/functions/signal-planner/index.ts` | Fix estimation formula, add weekly schedule, add Apify timeout |
| `supabase/functions/process-daily-signals/index.ts` | Support weekly schedule in cron processor |
| `src/components/leads/SignalScraperTab.tsx` | 3-way schedule selector, weekly badge, stale run detection |

