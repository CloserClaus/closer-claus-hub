

## Root Cause

The `execute_signal` action calls Apify's `run-sync-get-dataset-items` endpoint, which blocks until the actor finishes. With multi-source (LinkedIn + Indeed) and multi-keyword splitting (4-6 keywords each), this means **multiple sequential HTTP calls that each take 15-60 seconds**. The edge function hits its execution timeout before it can return a response.

## Fix: Background execution with `EdgeRuntime.waitUntil()`

Convert `execute_signal` to return immediately with a "running" status, then process in the background.

### Changes to `supabase/functions/signal-planner/index.ts`

**1. In the main handler (line 441-442)**, change the `execute_signal` branch:
- Instead of `return await handleExecuteSignal(...)`, do:
  - Update the signal run status to "running" (with schedule info)
  - Call `EdgeRuntime.waitUntil(handleExecuteSignal(...))` to run processing in background
  - Return immediately with `{ status: "running", run_id }` so the client gets a fast response

**2. Refactor `handleExecuteSignal` (line 602)**:
- Remove the `Response` return type — it now runs in background and just writes results to the DB
- Remove the early `return new Response(...)` for insufficient credits — move that check to the main handler before `waitUntil`
- Keep the try/catch that updates the run to "failed" on error
- Remove the final `return new Response(...)` — the function just completes silently

**3. Add `EdgeRuntime` type declaration** at top of file:
```typescript
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };
```

**4. Client-side polling** — the UI already polls `signal_runs` via react-query, so once the run status changes to "completed" or "failed" in the DB, the UI will pick it up on the next refetch. No client changes needed beyond ensuring the `signal-runs` query refetches periodically (it likely already does via `invalidateQueries` in the mutation's `onSuccess`).

**5. Update `useSignalScraper.ts`** — the `executeSignalMutation.onSuccess` handler currently expects `data.leads_discovered` and `data.credits_charged` in the response. Update it to handle the new `{ status: "running" }` response by showing a "Signal running in background" toast instead, and let the query invalidation handle the final state.

### Files

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Add EdgeRuntime declaration, move credit check to main handler, wrap execution in `waitUntil`, return immediately |
| `src/hooks/useSignalScraper.ts` | Update `onSuccess` to handle async "running" response |

