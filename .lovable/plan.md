
# Email Edge Cases Fixes Plan

Here is the technical plan to implement the 5 remaining edge case fixes for the email system:

### 1. First Email Visibility in Sequences
**File:** `src/components/email/FollowUpSequenceModal.tsx`
- **Change:** After invoking the `send-email` edge function and creating the `email_conversations` record, I will manually insert the first message into `email_conversation_messages` using the newly created conversation ID.
- **Details:** This ensures that the first email of a sequence is immediately visible in the Conversations tab. I'll also capture the first step's subject and body (with variables replaced) to accurately represent what was sent.

### 2. Conversation Reply Deduplication
**Files:** `supabase/functions/send-email/index.ts`, `src/components/email/EmailConversationsTab.tsx`
- **Change:** I will pass `conversation_id` in the `send-email` request payload from the `EmailConversationsTab`.
- **Details:** In the `send-email` edge function, when a `conversation_id` is provided, the function will use it directly to store the outbound message. This overrides the default behavior that mistakenly tries to find a conversation where `sequence_id IS NULL`, preventing the creation of duplicate conversation threads.

### 3. Provider Disconnect Confirmation
**File:** `src/components/email/EmailAccountsTab.tsx`
- **Change:** Add a `DeleteConfirmDialog` before allowing a user to disconnect an email provider.
- **Details:** I will add state to track `deleteProviderId`. When the user confirms deletion, the system will first fetch all inboxes for that provider, complete any `active_follow_ups` assigned to those inboxes, and reset the affected leads' `email_sending_state` to `idle`. Finally, it will delete the provider record.

### 4. Sequence Edit Safety Warnings
**Files:** `src/components/email/EmailSequencesTab.tsx`, `src/components/email/EmailCampaignsTab.tsx`
- **Change:** Display an inline warning when a user edits an existing sequence.
- **Details:** I'll import `AlertCircle` and add an alert banner in the sequence builder dialog if `editingSequence` is set. The banner will warn: *"Warning: Modifying a sequence that is currently active will affect all leads currently enrolled. They will receive the new steps."*

### 5. Campaign Resume Timing
**File:** `src/components/email/EmailCampaignsTab.tsx`
- **Change:** Update `handleToggleCampaignStatus` to reset the `next_send_at` timestamp.
- **Details:** When resuming a paused campaign (changing status from `paused` to `active`), I will update the `next_send_at` field to `new Date().toISOString()` (`now()`) for all affected `active_follow_ups`. This ensures that overdue emails do not all fire simultaneously out of order, and the cron can process them systematically.
