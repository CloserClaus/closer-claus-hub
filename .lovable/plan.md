

# Email System Review — Final Remaining Edge Cases

After a comprehensive review of all email components, edge functions, and data flows, the system is in excellent shape with all previous fixes correctly implemented. Five remaining edge cases exist, all related to data flow integrity between components.

## Issues Found

### 1. FollowUpSequenceModal: First email message not stored in conversation

When `FollowUpSequenceModal.startSequence` sends the first email (line 187), it passes `sequence_id` to `send-email`. However, `send-email` only creates conversation messages for non-sequence sends (the check on line 312: `if (lead_id && !sequence_id)`). The conversation record is created by the modal (line 200), but it has no messages in it until the cron processes step 1.

**Result**: The first email in any sequence started via `FollowUpSequenceModal` is invisible in the Conversations thread.

**Fix**: After the `send-email` invoke in `FollowUpSequenceModal.startSequence`, manually insert the outbound message into `email_conversation_messages` using the newly created conversation ID.

**File**: `src/components/email/FollowUpSequenceModal.tsx`

---

### 2. Conversation reply to sequence thread creates duplicate conversation

When a user replies from `EmailConversationsTab` to a conversation that has a `sequence_id`, the call to `send-email` does not include `sequence_id`. The `send-email` function (line 314-320) then looks for a conversation where `sequence_id IS NULL` — it won't find the existing sequence conversation, so it creates a **new** conversation and stores the outbound message there.

**Result**: The reply message appears in a newly-created conversation instead of the existing thread. The user sees the original conversation update its preview (line 194-197 in `EmailConversationsTab`), but the actual message is stored elsewhere.

**Fix**: In `EmailConversationsTab.handleSendReply`, pass the `conversation_id` to `send-email` so the edge function can store the message in the correct conversation. Add a `conversation_id` parameter to `send-email` that, when present, skips the auto-create logic and directly appends the message to the specified conversation.

**Files**: `src/components/email/EmailConversationsTab.tsx`, `supabase/functions/send-email/index.ts`

---

### 3. Provider disconnect has no confirmation dialog

`EmailAccountsTab.handleDisconnectProvider` (line 111) deletes the provider immediately with no confirmation. This cascade-deletes associated inboxes, which could orphan active sequences that reference those inboxes (the `sender_inbox_id` foreign key becomes invalid, causing the `process-sequences` cron to error out).

**Fix**: Add a `DeleteConfirmDialog` before disconnecting. The description should warn about active sequences. Before deleting, clean up `active_follow_ups` referencing inboxes of that provider.

**File**: `src/components/email/EmailAccountsTab.tsx`

---

### 4. Editing a sequence with active follow-ups is unsafe

`EmailSequencesTab.handleSave` and `EmailCampaignsTab.handleSave` delete all steps and re-insert them. If any active follow-ups reference this sequence, the step at `current_step` might no longer exist or might have different content. The cron would then mark the follow-up as completed (line 161-168 in `process-sequences`), silently ending sequences for enrolled leads.

**Fix**: Before allowing step edits, check for active follow-ups. If any exist, show a warning dialog explaining that editing will affect in-progress sequences. Alternatively, prevent step deletion/reordering while leads are enrolled (only allow body/subject edits).

**Files**: `src/components/email/EmailSequencesTab.tsx`, `src/components/email/EmailCampaignsTab.tsx`

---

### 5. Resuming paused campaigns fires all queued emails immediately

`EmailCampaignsTab.handleToggleCampaignStatus` (line 283-286) sets paused follow-ups back to `active` without updating `next_send_at`. If a campaign was paused for days, all follow-ups have stale `next_send_at` values in the past and the cron will fire them all simultaneously on the next run (within the 50-record limit).

**Fix**: When resuming, recalculate `next_send_at` relative to now. Set it to `now()` for follow-ups that were already overdue, so the cron processes them in order with staggered delays.

**File**: `src/components/email/EmailCampaignsTab.tsx`

---

## Implementation Summary

| # | Issue | Files | Risk |
|---|-------|-------|------|
| 1 | First sequence email invisible in thread | FollowUpSequenceModal.tsx | Low |
| 2 | Reply to sequence thread creates duplicate conversation | EmailConversationsTab.tsx, send-email/index.ts | Medium |
| 3 | Provider disconnect without confirmation | EmailAccountsTab.tsx | Medium |
| 4 | Editing active sequences breaks enrolled leads | EmailSequencesTab.tsx, EmailCampaignsTab.tsx | Medium |
| 5 | Resume fires all paused emails at once | EmailCampaignsTab.tsx | Medium |

No database migrations needed. All fixes are frontend logic and edge function parameter handling.

