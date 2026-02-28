

# Fix Klaus Execution Layer + Add Confirmation Dialog + Context-Aware Actions

## Phase 1: Fix Critical Bugs

### 1.1 Fix `update_leads` — leads table has NO `status` column
**File**: `supabase/functions/klaus/index.ts`

The `leads` table does not have a `status` column. The available fields are: `readiness_segment`, `email_sending_state`, `notes`, `assigned_to`, `last_contacted_at`, etc.

- Rename `update_leads` to reflect what it actually can update
- Replace `set_status` / `filter_status` with `set_readiness_segment` / `filter_readiness_segment` (values: Hot, Warm, Cool, Cold)
- Also support updating `notes`, `assigned_to`, `email_sending_state`
- Fix `query_leads` to stop referencing `status` — use `readiness_segment` instead

### 1.2 Fix `update_deals` — use correct stage values
**File**: `supabase/functions/klaus/index.ts`

Valid stages: `new`, `contacted`, `discovery`, `meeting`, `proposal`, `closed_won`, `closed_lost`. Add validation so Klaus rejects invalid stages. When moving to `closed_won`, set `closed_at`. When moving to `closed_won`, trigger commission creation via `create-commission` edge function.

## Phase 2: Confirmation Dialog UI

### 2.1 Add `KlausConfirmationDialog` component
**New file**: `src/components/klaus/KlausConfirmationDialog.tsx`

A floating modal dialog that appears when Klaus needs confirmation:
- Shows action summary (e.g., "82 leads will be moved to the 'Contacted' stage")
- "Confirm" and "Cancel" buttons
- Appears above the Klaus chat window

### 2.2 Integrate confirmation into KlausChat
**File**: `src/components/klaus/KlausChat.tsx`

- Parse Klaus responses for confirmation patterns (e.g., "Should I proceed?" or responses containing `affected_count`)
- When detected, show `KlausConfirmationDialog` instead of requiring the user to type "yes"
- On "Confirm" click, automatically send "Yes, proceed" to Klaus
- On "Cancel" click, send "No, cancel"

Detection logic: look for patterns like `"X leads would be"`, `"Should I proceed?"`, `"Do you confirm?"` in assistant messages.

## Phase 3: Context-Aware Execution Tools

### 3.1 Add `query_calls_today_no_answer` tool
**File**: `supabase/functions/klaus/index.ts`

New tool that queries `call_logs` for today where `call_status != 'completed'` (no answer/busy/failed), joined with `leads` to return lead IDs. This enables: "Send follow-up sequence to all leads I called today that didn't pick up."

### 3.2 Add `smart_enroll_sequence` tool
**File**: `supabase/functions/klaus/index.ts`

Enhanced version of `enroll_in_sequence` that accepts context filters:
- `filter_called_today_no_answer: true` — leads called today with no answer
- `filter_called_today_short_calls: true` — leads called today with calls < 30s
- `filter_no_email_sent: true` — leads with no email logs
- `filter_not_in_active_sequence: true` — leads not already in an active sequence
- Automatically excludes leads already in active sequences

### 3.3 Add `update_deal_stage` tool (enhanced)
**File**: `supabase/functions/klaus/index.ts`

Support moving deals between pipeline stages with proper handling:
- When moving to `closed_won`: set `closed_at`, invoke `create-commission`
- When moving to `closed_lost`: set `closed_at`
- Log `deal_activities` entry for stage changes

### 3.4 Add `delete_leads` tool
**File**: `supabase/functions/klaus/index.ts`

Delete leads by IDs or filter. Always requires confirmation. Returns count of deleted leads.

### 3.5 Add `send_email_to_leads` tool
**File**: `supabase/functions/klaus/index.ts`

Send a one-off email to specific leads using an email template:
- `template_name` or `subject` + `body`
- `lead_ids` or filter criteria
- Uses the workspace's configured email inbox

### 3.6 Add `create_task` tool
**File**: `supabase/functions/klaus/index.ts`

Create CRM tasks assigned to SDRs:
- `title`, `description`, `due_date`, `assigned_to_name`, `lead_id`, `deal_id`

### 3.7 Add `schedule_callback` tool
**File**: `supabase/functions/klaus/index.ts`

Schedule a callback reminder for a lead:
- `lead_id`, `callback_time`, `notes`, `assigned_to_name`

## Phase 4: System Prompt Enhancement

### 4.1 Update system prompt with schema awareness
**File**: `supabase/functions/klaus/index.ts`

Add to the system prompt:
- **LEADS have NO status column.** Use `readiness_segment` (Hot/Warm/Cool/Cold) for categorization.
- **DEALS have stages:** new → contacted → discovery → meeting → proposal → closed_won / closed_lost
- **Context-aware execution examples:** When user says "send follow-up to leads that didn't pick up today", use `smart_enroll_sequence` with `filter_called_today_no_answer: true`
- Add rule: when performing multi-step context-aware actions, break them into tool calls internally and present a single confirmation to the user

### 4.2 Add NEVER REFUSE rule enforcement
**File**: `supabase/functions/klaus/index.ts`

Strengthen the prompt: "If you encounter an error with a tool, explain the specific error. NEVER give up and say 'contact support'. Try alternative approaches or explain what went wrong."

## Technical Details

### Confirmation Dialog Detection
In `KlausChat.tsx`, after receiving an assistant message, check if it matches confirmation patterns:
```
const CONFIRMATION_PATTERNS = [
  /(\d+)\s+(leads?|deals?|records?)\s+(would be|will be)/i,
  /should I proceed/i,
  /do you confirm/i,
  /shall I go ahead/i,
];
```
If matched, extract the summary text and show the dialog.

### Valid Lead Operations (no status column)
- Update `readiness_segment` (Hot, Warm, Cool, Cold, null)
- Update `notes`
- Update `assigned_to`
- Update `email_sending_state` (idle, active_sequence, replied, error)
- Update `last_contacted_at`
- Delete leads

### Smart Sequence Enrollment Query
```sql
SELECT l.id FROM leads l
JOIN call_logs cl ON cl.lead_id = l.id AND cl.workspace_id = l.workspace_id
WHERE l.workspace_id = $wid
AND cl.created_at >= (current_date AT TIME ZONE 'UTC')
AND cl.call_status IN ('no-answer', 'busy', 'failed', 'canceled')
AND l.id NOT IN (
  SELECT af.lead_id FROM active_follow_ups af 
  WHERE af.status = 'active' AND af.workspace_id = $wid
)
```

