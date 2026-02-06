

## Problem

Twilio shows ~23 minutes of usage for Agency 6, but Closer Claus still shows 1000/1000 free minutes. The `deduct_minutes` logic exists in the backend but is **never called by anything** -- it's orphaned code.

## Root Cause

When a call completes, the `twilio-webhook` receives the `completed` status with `CallDuration` from Twilio and saves it to `call_logs.duration_seconds`. But it stops there. It never triggers the `deduct_minutes` action to subtract those minutes from `workspace_credits`.

No other part of the system (frontend or backend) calls `deduct_minutes` either.

## Fix

Wire the minute deduction directly into the `twilio-webhook` so that every completed call automatically deducts minutes. This is the correct place because:
- The webhook is the only reliable source of the final call duration (Twilio reports it server-side).
- It works even if the user closes their browser mid-call.

### Step 1: Add deduction logic to `twilio-webhook`

In `supabase/functions/twilio-webhook/index.ts`, after the `call_logs` update for a `completed` call with a duration, add logic to:

1. Look up the `workspace_id` from the `call_logs` record (using the `twilio_call_sid`).
2. Convert `CallDuration` (seconds) to minutes (rounded up to the nearest minute, matching Twilio's billing).
3. Fetch current `workspace_credits` for that workspace.
4. Deduct from `free_minutes_remaining` first, then from `credits_balance` for any remainder.
5. Update `workspace_credits`.

### Step 2: Backfill Agency 6's usage

Run a one-time correction query to deduct the ~23 minutes that were already consumed but not tracked. This will be done via a database migration that:
1. Queries `call_logs` for the workspace to sum up `duration_seconds` for completed calls.
2. Deducts the total from `free_minutes_remaining` in `workspace_credits`.

### Technical Details

**Webhook change** (`supabase/functions/twilio-webhook/index.ts`):

After the existing block that updates `call_logs` on completion (around line 116-123), add:

```text
if (callStatus === 'completed' && callDuration) {
  // existing: update call_logs ...

  // NEW: deduct minutes from workspace credits
  const durationSeconds = parseInt(callDuration);
  const minutesUsed = Math.ceil(durationSeconds / 60); // round up like Twilio

  // Get workspace_id from the call log
  const { data: callLog } = await supabase
    .from('call_logs')
    .select('workspace_id')
    .eq('twilio_call_sid', callSid)
    .maybeSingle();

  if (callLog?.workspace_id && minutesUsed > 0) {
    const { data: credits } = await supabase
      .from('workspace_credits')
      .select('credits_balance, free_minutes_remaining')
      .eq('workspace_id', callLog.workspace_id)
      .single();

    let freeMinutes = credits?.free_minutes_remaining ?? 1000;
    let paidMinutes = credits?.credits_balance || 0;
    let remaining = minutesUsed;

    // Free minutes first
    const fromFree = Math.min(freeMinutes, remaining);
    freeMinutes -= fromFree;
    remaining -= fromFree;

    // Then paid
    if (remaining > 0) {
      paidMinutes = Math.max(0, paidMinutes - remaining);
    }

    await supabase
      .from('workspace_credits')
      .update({
        free_minutes_remaining: freeMinutes,
        credits_balance: paidMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', callLog.workspace_id);
  }
}
```

**Backfill migration** (new SQL migration):

```sql
-- Sum all completed call durations for each workspace and deduct from free minutes
UPDATE workspace_credits wc
SET free_minutes_remaining = GREATEST(
  0,
  wc.free_minutes_remaining - COALESCE(
    (SELECT CEIL(SUM(cl.duration_seconds)::numeric / 60)
     FROM call_logs cl
     WHERE cl.workspace_id = wc.workspace_id
       AND cl.call_status = 'completed'
       AND cl.duration_seconds > 0),
    0
  )
),
updated_at = now();
```

### Files to modify
- `supabase/functions/twilio-webhook/index.ts` -- add deduction logic after call completion
- New database migration -- backfill historical usage

### What stays the same
- The existing `deduct_minutes` action in `twilio/index.ts` remains available for any future manual/frontend use
- Call logging, recording, and status tracking are unchanged
- Free-minutes-first priority is preserved
- Monthly reset logic is unaffected

