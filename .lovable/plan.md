

# Email Edge Cases — Implementation Plan

All 5 fixes are straightforward code changes with no database migrations needed.

## Fix 1: First Email Visibility in Sequences
**File:** `src/components/email/FollowUpSequenceModal.tsx` (lines 199-208)

Change the `email_conversations` insert to return the new ID via `.select('id').single()`, then add `last_message_preview` and `last_activity_at` to the insert. After the insert, add a second insert into `email_conversation_messages` with direction `outbound`, the resolved subject/body, and `sender_email` from the assigned inbox.

## Fix 2: Conversation Reply Deduplication
**File 1:** `supabase/functions/send-email/index.ts` (line 177)
- Add `conversation_id` to the destructured request body.
- At line 312, change the condition to: `if (conversation_id)` — use the provided ID directly to insert a message and update the conversation preview. Else fall through to the existing `if (lead_id && !sequence_id)` logic.

**File 2:** `src/components/email/EmailConversationsTab.tsx` (lines 181-189)
- Add `conversation_id: selectedConvo.id` to the `send-email` invoke body.

## Fix 3: Provider Disconnect Confirmation
**File:** `src/components/email/EmailAccountsTab.tsx`
- Import `DeleteConfirmDialog` from `@/components/crm/DeleteConfirmDialog`.
- Add state: `deleteProviderId` and `disconnecting`.
- Change `handleDisconnectProvider` to just set `deleteProviderId`.
- Add `confirmDisconnect` that: fetches inboxes for the provider, updates `active_follow_ups` using those inbox IDs to `completed`, resets affected leads' `email_sending_state` to `idle`, then deletes the provider.
- Render `DeleteConfirmDialog` at the bottom with a warning about active sequences.

## Fix 4: Sequence Edit Safety Warnings
**File 1:** `src/components/email/EmailSequencesTab.tsx` (line 2)
- Add `AlertCircle` to lucide imports.
- After the `DialogTitle` (line 299), add: if `editingSequence`, render an `Alert` with `AlertCircle` icon warning that modifying an active sequence affects enrolled leads.

**File 2:** `src/components/email/EmailCampaignsTab.tsx` (line 2)
- Add `AlertCircle` to lucide imports. Import `Alert, AlertDescription` from `@/components/ui/alert`.
- After the `DialogTitle` (line 489), add the same warning banner when `editingSequence` is set.

## Fix 5: Campaign Resume Timing
**File:** `src/components/email/EmailCampaignsTab.tsx` (lines 284-286)

When resuming (newStatus === 'active'), change the update to also set `next_send_at: new Date().toISOString()`:
```typescript
await supabase.from('active_follow_ups')
  .update({ status: 'active', next_send_at: new Date().toISOString() } as any)
  .eq('sequence_id', seqId)
  .eq('status', 'paused');
```

## Summary
- 5 files edited, 1 edge function redeployed
- No database migrations
- All changes are additive safety improvements

