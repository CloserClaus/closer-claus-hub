

# Email System Comprehensive Improvement Plan

## Current State Summary

The email infrastructure is architecturally sound for Gmail-based outreach. Cron jobs for `process-sequences` (every 5 min) and `check-email-replies` (every 10 min) are active. However, there are several operational bugs and missing features that need addressing before production use.

---

## Phase 1: Critical Operational Fixes (Must-Have)

### 1A. Add `reset_daily_send_counts` Cron Job

**Problem**: The `reset_daily_send_counts()` DB function exists but has no `pg_cron` trigger. Once an inbox hits its daily limit, `sends_today` never resets — the inbox is permanently locked.

**Fix**: Insert a cron job via `pg_cron` to call the function daily at midnight UTC.

**Backend**: SQL insert into `cron.schedule` to call `reset_daily_send_counts()` at `0 0 * * *`.

---

### 1B. Fix `SendEmailButton.handleStartSequence` — Missing `next_send_at`

**Problem**: `SendEmailButton.tsx` line 86 creates an `active_follow_ups` record without `next_send_at`. The `process-sequences` cron only picks up records where `next_send_at <= now()`. Without this field, the sequence never advances.

Additionally, unlike `FollowUpSequenceModal`, this path does NOT send the first email and does NOT create an `email_conversation`.

Wait — looking at the code again, `SendEmailButton` does create a conversation (line 101) and sets `sender_inbox_id` (line 93). But it still lacks `next_send_at` and doesn't send the first email.

**Fix** in `src/components/email/SendEmailButton.tsx`:
- Compute `next_send_at` based on `steps[0].delay_days` (need to fetch steps first)
- OR simpler: set `next_send_at: new Date().toISOString()` so the cron picks it up immediately and sends step 0 on next cycle
- This avoids needing to fetch steps or invoke `send-email` inline

**File**: `src/components/email/SendEmailButton.tsx` — add `next_send_at: new Date().toISOString()` to the insert payload on line 86.

---

### 1C. Fix `sends_today` Increment Race Condition

**Problem**: `send-email/index.ts` line 253 calls `supabase.rpc('increment_sends_today')` which doesn't exist, then falls back to a read-then-write pattern that's racy under concurrent sends.

**Fix**: Remove the RPC call and use a direct SQL increment via `.rpc()` or use the fallback consistently. Since we can't create RPCs from edge functions, change to:
```
UPDATE email_inboxes SET sends_today = sends_today + 1 WHERE id = inbox_id
```
Same fix needed in `process-sequences/index.ts` line 377.

**Files**: `supabase/functions/send-email/index.ts`, `supabase/functions/process-sequences/index.ts`

---

## Phase 2: Unsubscribe / Opt-Out Compliance

### 2A. Add `opted_out` Column to Leads

**Backend**: Migration to add `opted_out boolean DEFAULT false` and `opted_out_at timestamptz` to the `leads` table.

### 2B. Create Unsubscribe Edge Function

**Backend**: New `supabase/functions/unsubscribe/index.ts` — a public (no JWT) endpoint that:
- Accepts `?lead_id=xxx&token=yyy` (HMAC-signed to prevent spoofing)
- Sets `opted_out = true` on the lead
- Returns a simple "You've been unsubscribed" HTML page

### 2C. Auto-Insert Unsubscribe Link in Outbound Emails

**Backend**: In both `send-email` and `process-sequences`, append an unsubscribe footer to email bodies before sending. Generate the HMAC token per-lead.

### 2D. Respect Opt-Out in Sending

**Backend**: In `send-email/index.ts` and `process-sequences/index.ts`, add a check: if `lead.opted_out === true`, skip the send and mark the follow-up as completed with reason `opted_out`.

**Frontend**: Show an `opted_out` badge on leads in the CRM sidebar.

**Files**: Migration, new edge function, `send-email/index.ts`, `process-sequences/index.ts`, `LeadDetailSidebar.tsx`

---

## Phase 3: Duplicate Sequence Prevention

### 3A. Prevent Starting a Sequence for a Lead Already in One

**Problem**: `SendEmailButton` doesn't check `email_sending_state` before inserting `active_follow_ups`. A user can start multiple sequences for the same lead.

**Fix** in `SendEmailButton.tsx`: Before inserting, query the lead's `email_sending_state`. If it's `active_sequence`, show an error toast and abort. (Note: `FollowUpSequenceModal` already does this check.)

**File**: `src/components/email/SendEmailButton.tsx`

---

## Phase 4: Email Conversation Creation for Sequence Starts

### 4A. Ensure `SendEmailButton` Creates Conversation with Campaign Name

**Problem**: The conversation is created but `campaign_name` is pulled from in-memory `sequences` array which only has `id` and `name`. This is fine. But the conversation has no `sequence_id`, making reply detection unable to link the conversation back.

Wait — looking at line 106, `sequence_id: selectedSequence` IS set. This is actually correct. The real issue is just the missing `next_send_at`. Phase 1B covers this.

---

## Phase 5: Reply Deduplication in `check-email-replies`

### 5A. Prevent Duplicate Reply Detection

**Problem**: `check-email-replies` searches Gmail for messages `from:lead_email after:started_at`. If it finds the same reply on consecutive runs, it will create duplicate `email_conversation_messages`, duplicate notifications, and try to stop an already-stopped sequence.

**Fix**: Store `gmail_message_id` on inbound messages (already done in the insert). Before processing a reply, check if a message with that `gmail_message_id` already exists. Skip if duplicate.

**File**: `supabase/functions/check-email-replies/index.ts` — add dedup check before line 109.

---

## Phase 6: Process-Sequences Error Resilience

### 6A. Retry Logic for Transient Failures

**Problem**: If Gmail returns a 429 (rate limit), the follow-up is marked `status: 'error'` permanently. There's no retry.

**Fix**: For transient errors (`rate_limit`, `api_failure`), instead of setting `status: 'error'`, reschedule `next_send_at` to 15 minutes later and increment a `retry_count`. Only mark as `error` after 3 retries.

**Backend**: Migration to add `retry_count integer DEFAULT 0` to `active_follow_ups`.  
**File**: `supabase/functions/process-sequences/index.ts` — update the error branch (line 446).

---

## Implementation Order

| Phase | Scope | Risk | Effort |
|-------|-------|------|--------|
| **1** (Cron + next_send_at + increment fix) | Backend + 1 frontend file | Low — pure bug fixes | Small |
| **2** (Unsubscribe) | Migration + new edge function + 2 edge functions + 1 frontend | Medium — new feature | Medium |
| **3** (Duplicate sequence guard) | 1 frontend file | Low | Tiny |
| **5** (Reply dedup) | 1 edge function | Low | Small |
| **6** (Retry logic) | Migration + 1 edge function | Low | Small |

Phases 1, 3, 5, 6 are pure fixes with no UI impact beyond error prevention. Phase 2 adds a visible unsubscribe link in emails and a new edge function.

