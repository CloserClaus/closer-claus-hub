

# Email System Review — Remaining Edge Cases

After reviewing all frontend components, edge functions, and data flows post-implementation, the system is in strong shape. Here are the remaining issues:

## Issues Found

### 1. `EmailComposerModal` has no opt-out guard
The composer (used from `LeadDetailSidebar`, `DealDetailSidebar`, and `LeadsTab`) does not check `lead.opted_out` before sending. The sidebar buttons are disabled, but:
- `LeadsTab` has an inline email icon per row that opens the composer directly — no opt-out check there
- If the composer is somehow opened for an opted-out lead, it will submit to `send-email` and get a server error instead of a clean UX message

**Fix**: Add a client-side `opted_out` check in `EmailComposerModal.handleSend` that aborts with a toast. Also update `LeadsTab` to disable the email icon for opted-out leads.

**Files**: `src/components/email/EmailComposerModal.tsx`, `src/components/crm/LeadsTab.tsx`

### 2. `check-email-replies` conversation lookup is inconsistent
The conversation lookup at line 164-171 uses `lead_id + workspace_id` to find the conversation for storing inbound reply messages. This was fixed in `process-sequences` to use `sequence_id + lead_id`, but not here. If a lead has multiple conversations (manual + sequence), the reply could be stored in the wrong one.

**Fix**: Use `sequence_id + lead_id` when `fup.sequence_id` exists, falling back to `lead_id + workspace_id` otherwise.

**File**: `supabase/functions/check-email-replies/index.ts`

### 3. Conversations reply box doesn't check opt-out
In `EmailConversationsTab`, the reply box at line 165-199 sends a reply via `send-email` without checking if the lead has opted out. The server will reject it, but the UX should proactively block it.

**Fix**: Before sending a reply, fetch the lead's `opted_out` status, or pass it through the conversation data. Display a disabled state with message if opted out.

**File**: `src/components/email/EmailConversationsTab.tsx`

### 4. Campaign delete doesn't clean up `active_follow_ups`
In `EmailCampaignsTab.handleDelete` (line 186-192), deleting a sequence removes steps and the sequence record, but doesn't stop active follow-ups or reset lead states. Leads could be stuck with `email_sending_state: 'active_sequence'` permanently with orphaned `active_follow_ups` records pointing to a deleted sequence.

**Fix**: Before deleting, update all `active_follow_ups` for that sequence to `status: 'completed'`, and reset affected leads' `email_sending_state` to `'idle'`.

**File**: `src/components/email/EmailCampaignsTab.tsx`

### 5. Sequence delete in `EmailSequencesTab` has the same orphan problem
Same issue as #4 — `handleDelete` on line 126-131 deletes steps and sequence but leaves active follow-ups and lead states dangling.

**Fix**: Same cleanup pattern as #4.

**File**: `src/components/email/EmailSequencesTab.tsx`

### 6. No confirmation dialog for destructive actions
Template delete, sequence delete, campaign delete, and provider disconnect all execute immediately without confirmation. A misclick permanently deletes data.

**Fix**: Add a confirmation dialog (using existing `DeleteConfirmDialog` component) before delete actions on sequences, templates, and campaigns.

**Files**: `EmailSequencesTab.tsx`, `EmailTemplatesTab.tsx`, `EmailCampaignsTab.tsx`

### 7. `EmailComposerModal` doesn't create `email_conversation` for manual sends
When sending a one-off email via the composer, the server-side `send-email` function auto-creates a conversation (line 311-363). However, the `handleSendReply` in `EmailConversationsTab` manually inserts into `email_conversation_messages` after calling `send-email` — this creates a **duplicate outbound message** since `send-email` already creates the conversation message for non-sequence sends.

**Fix**: In `EmailConversationsTab.handleSendReply`, remove the manual `email_conversation_messages` insert — the `send-email` function already handles it. Only update the conversation's `last_message_preview` and `last_activity_at`.

Wait — actually, replies from the Conversations tab include the `lead_id` but no `sequence_id`. The `send-email` function will find the existing conversation (line 314-320 checks `is('sequence_id', null)`) and insert the message. So the manual insert at line 180-187 in `EmailConversationsTab` IS creating a duplicate.

**Fix**: Remove the duplicate message insert from `EmailConversationsTab.handleSendReply`. The server already handles it.

**File**: `src/components/email/EmailConversationsTab.tsx`

## Summary

| # | Issue | Files | Risk |
|---|-------|-------|------|
| 1 | EmailComposerModal + LeadsTab no opt-out guard | 2 files | Low |
| 2 | check-email-replies wrong conversation lookup | 1 edge function | Low |
| 3 | Conversation reply doesn't check opt-out | 1 file | Low |
| 4 | Campaign delete orphans active_follow_ups | 1 file | Medium |
| 5 | Sequence delete orphans active_follow_ups | 1 file | Medium |
| 6 | No delete confirmation dialogs | 3 files | Low |
| 7 | Duplicate outbound message in conversation replies | 1 file | Low |

All fixes are additive guards, query corrections, or cleanup logic. No migrations or architectural changes needed.

