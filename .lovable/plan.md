
Root cause identified: this run is being flagged “stale” for two different reasons, and one is a UI false-positive.

1) What is actually happening in this run
- In backend logs, two jobs failed to start with:
  - `actor-memory-limit-exceeded (402)` from Apify
  - Message indicates account-wide actor memory already at 8192MB and new run requested 1024MB.
- Current run state confirms:
  - 4 LinkedIn jobs succeeded
  - 2 jobs failed at start (memory-cap failures)
  - 4 Indeed jobs still `RUNNING`
  - phase remains `scraping` until those 4 resolve

2) Why it appears stale “again”
- UI marks stale at 10 minutes (`SignalScraperTab.tsx`), based only on `started_at`.
- Worker timeout for each actor run is 15 minutes (`process-signal-queue/index.ts`).
- So between minute 10 and 15, UI says stale even when backend is still within expected timeout window.
- This is why it feels stale “again” even though timeout logic hasn’t triggered yet.

3) Is this a LinkedIn-only issue?
- No. The `402 actor-memory-limit-exceeded` is account-level capacity pressure, so any actor type can hit it (Indeed/Google Maps/Yelp/etc.), not just LinkedIn.

Implementation plan to prevent repeats:

A) Make start-phase resilient to provider capacity (primary fix)
- File: `supabase/functions/process-signal-queue/index.ts`
- Change behavior for Apify start errors:
  - Detect memory-capacity errors (`402`, `actor-memory-limit-exceeded`).
  - Do NOT permanently mark those refs as `FAILED` immediately.
  - Mark as retryable (`DEFERRED`/`START_RETRY`) and attempt again in next cycles with backoff.
- Add per-run start-attempt tracking and cap (e.g., 5 attempts per job) to avoid infinite loops.
- Keep partial-success model: continue pipeline once all jobs are terminal or retry budget exhausted.

B) Reduce burst concurrency during job start
- File: `supabase/functions/process-signal-queue/index.ts`
- Lower/parameterize `BATCH_SIZE` (currently 3), and apply actor-aware throttling:
  - Heavy actors (LinkedIn/Indeed): start fewer at once (e.g., 1–2).
  - Lighter actors can remain higher.
- Goal: avoid triggering provider memory ceiling spikes.

C) Align stale UX with backend reality
- File: `src/components/leads/SignalScraperTab.tsx`
- Replace fixed 10-min stale rule with phase-aware logic:
  - “Long-running” warning at 15+ min (or based on no `updated_at` heartbeat for >2 polling intervals).
  - “Stale” only when truly stuck (no state progress/heartbeat beyond threshold).
- Prevent users from seeing healthy long jobs as stale prematurely.

D) Improve operator visibility
- File: `src/components/leads/SignalScraperTab.tsx` (+ existing run log data)
- Display status breakdown inline: succeeded / failed / running / timed-out.
- Show failure reason category (e.g., “Provider capacity throttling”) so users know it’s recoverable.

E) Optional guardrail for large fan-out searches
- File: `supabase/functions/signal-planner/index.ts` and/or queue worker
- Add adaptive keyword fan-out cap when provider is under capacity pressure.
- Keep broad discovery intent but degrade gracefully (queue rest for next cycle) instead of hard-failing starts.

Expected outcome after implementation
- Capacity throttling won’t cause immediate hard failures.
- Runs will progress with retries and partial completion instead of appearing stuck.
- UI “stale” label will reflect true stuck state, not normal long execution windows.
