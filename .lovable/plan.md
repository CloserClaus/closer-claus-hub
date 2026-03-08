

# Fix: Signal Planner Routing Mismatch + Missing Execute Handler

## Problem
The `signal-planner` edge function routes requests based on `url.pathname === "/generate-plan"` (line 779), but the frontend calls `supabase.functions.invoke('signal-planner', { body: { action: 'generate_plan', ... } })` which hits the function root path (`/signal-planner`). The pathname never matches, so **every request returns 404**.

Additionally, the frontend sends `action: 'execute_signal'` (line 171 of `useSignalScraper.ts`) but there is **no handler for it** in the edge function.

## Fix in `signal-planner/index.ts`

Replace the pathname-based routing (lines 778-785) with action-based routing that reads `action` from the request body:

```typescript
const body = await req.json();
const action = body.action || "generate_plan";
const userId = req.headers.get("x-user-id") || body.user_id || "anonymous";

if (action === "generate_plan") {
  return await handleGeneratePlan(body, userId, supabaseClient);
}

if (action === "execute_signal") {
  return await handleExecuteSignal(body, supabaseClient);
}

return new Response(JSON.stringify({ error: "Unknown action" }), {
  status: 400,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
```

Add `handleExecuteSignal` function that:
1. Reads `run_id`, `workspace_id`, `schedule_type`, `schedule_hour` from body
2. Fetches the planned signal run from `signal_runs`
3. Deducts credits from `lead_credits`
4. Updates signal run status to `queued`
5. Returns `{ status: "queued", run_id }`

The `process-signal-queue` cron picks up queued runs — no further changes needed there.

## Files Modified
- `supabase/functions/signal-planner/index.ts` — Replace pathname routing with action routing, add `handleExecuteSignal`

## Estimated size
~60 lines changed/added

