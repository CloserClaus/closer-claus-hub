

# Email System Post-Change Review: Remaining Edge Cases

## What Was Fixed (Verified Working)

All 6 phases are implemented correctly:
- `reset_daily_send_counts` cron scheduled
- `SendEmailButton` now sets `next_send_at` and checks `email_sending_state` before starting
- `increment_inbox_sends_today` RPC exists and is called atomically
- Unsubscribe edge function deployed with HMAC verification, `verify_jwt = false` in config
- `opted_out` badge shows in `LeadDetailSidebar`
- Reply dedup via `gmail_message_id` check in `check-email-replies`
- Retry logic (3 attempts, 15-min backoff) in `process-sequences`

## Remaining Edge Cases

### 1. LeadDetailSidebar doesn't block email actions for opted-out leads

The sidebar shows a "🚫 Opted Out" badge but the "Send Email" and "Start Sequence" buttons remain fully clickable. The server-side `send-email` function will reject it, but the user gets a confusing error instead of a proactively disabled button.

**Fix**: Disable the Send Email and Start Sequence buttons when `lead.opted_out === true`. Show a tooltip explaining why.

**File**: `src/components/crm/LeadDetailSidebar.tsx`

---

### 2. `FollowUpSequenceModal` doesn't check `opted_out`

The modal checks `email_sending_state` but not `opted_out`. A user could start a sequence for an opted-out lead — the first email call would fail server-side, but the `active_follow_ups` record and `email_sending_state = 'active_sequence'` would already be written, leaving the lead in a broken state.

**Fix**: Add `opted_out` to the lead query in `startSequence` and abort early with a toast if true.

**File**: `src/components/email/FollowUpSequenceModal.tsx`

---

### 3. `SendEmailButton` doesn't check `opted_out` client-side

Same issue — the sequence guard checks `email_sending_state` but not `opted_out`. Server will reject it but the client creates orphaned records first.

**Fix**: Add `opted_out` to the lead query in `handleStartSequence` (line 87) and `handleSend`.

**File**: `src/components/email/SendEmailButton.tsx`

---

### 4. `FollowUpSequenceModal` doesn't create an `email_conversation`

Unlike `SendEmailButton` which creates a conversation record, `FollowUpSequenceModal.startSequence` does not insert into `email_conversations`. This means conversations started via the modal won't appear in the Conversations tab until the cron sends the first email and updates a conversation that doesn't exist yet — the `process-sequences` update query (line 372) will match 0 rows.

**Fix**: Add an `email_conversations` insert in `FollowUpSequenceModal.startSequence` after creating the `active_follow_ups` record, mirroring what `SendEmailButton` does.

**File**: `src/components/email/FollowUpSequenceModal.tsx`

---

### 5. `DealDetailSidebar` doesn't show opted-out badge or disable actions

The deal sidebar also embeds `FollowUpSequenceModal` and email actions but has no opted-out checks or UI indicators.

**Fix**: Add the same `opted_out` badge and button disabling logic as `LeadDetailSidebar`.

**File**: `src/components/crm/DealDetailSidebar.tsx`

---

### 6. Unsubscribe function has dead code

The `unsubscribe/index.ts` file has an unused `generateHmac` function (lines 9-22) — a simple hash that's never called. Only `generateHmacSHA256` is used. This is harmless but should be cleaned up.

**Fix**: Remove the `generateHmac` function.

**File**: `supabase/functions/unsubscribe/index.ts`

---

### 7. `process-sequences` conversation message store may create duplicates

In `process-sequences` (line 381-398), after sending an email it looks up the conversation by `lead_id + workspace_id` ordered by `created_at DESC`. If a lead has multiple conversations (e.g., a manual email thread and a sequence thread), the outbound message could be stored in the wrong conversation.

**Fix**: Look up the conversation by `sequence_id + lead_id` instead of just `lead_id + workspace_id`, matching the update query pattern on line 377.

**File**: `supabase/functions/process-sequences/index.ts`

---

## Implementation Summary

| # | Fix | File | Risk |
|---|-----|------|------|
| 1 | Disable email buttons for opted-out leads | LeadDetailSidebar.tsx | Low |
| 2 | Check opted_out in FollowUpSequenceModal | FollowUpSequenceModal.tsx | Low |
| 3 | Check opted_out in SendEmailButton | SendEmailButton.tsx | Low |
| 4 | Create email_conversation in FollowUpSequenceModal | FollowUpSequenceModal.tsx | Low |
| 5 | Opted-out handling in DealDetailSidebar | DealDetailSidebar.tsx | Low |
| 6 | Remove dead code in unsubscribe function | unsubscribe/index.ts | None |
| 7 | Fix conversation lookup in process-sequences | process-sequences/index.ts | Low |

All fixes are additive guards or query corrections — no architectural changes, no migrations needed.

