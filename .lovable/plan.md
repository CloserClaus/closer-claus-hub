

# Add Execution Tools to Klaus

## Problem
Klaus currently has only read-only tools. When users ask it to move leads, assign SDRs, enroll sequences, etc., it says "I cannot directly manipulate data." Users expect Klaus to execute commands.

## Plan

### 1. Add write tool definitions to TOOLS array
**File**: `supabase/functions/klaus/index.ts`

Add 7 new tool definitions after the existing `analyze_bottleneck` tool:

| Tool | Purpose | Params |
|------|---------|--------|
| `update_leads` | Update lead status/fields by filter or IDs | `lead_ids`, `filter_status`, `all`, `set_status`, `set_notes`, `confirmed` |
| `update_deals` | Move deals to new stage | `deal_ids`, `filter_stage`, `all`, `set_stage`, `confirmed` |
| `assign_leads_to_sdr` | Assign leads to an SDR by name | `sdr_name`, `lead_ids`, `filter_unassigned`, `filter_status`, `limit`, `confirmed` |
| `enroll_in_sequence` | Enroll leads in a follow-up sequence | `sequence_name`, `lead_ids`, `filter_status`, `filter_no_calls_today`, `confirmed` |
| `send_training_to_sdr` | Assign training material to an SDR | `training_title`, `sdr_name`, `confirmed` |
| `create_lead` | Create a single lead | `first_name`, `last_name`, `email`, `company`, `phone`, `title` |
| `create_deal` | Create a deal | `title`, `value`, `stage`, `assigned_to_name`, `lead_id` |

All write tools require `confirmed: true` to execute.

### 2. Add write tool executors to the `executeTool` switch
**File**: `supabase/functions/klaus/index.ts`

Each executor:
- Validates `confirmed === true`, returns preview with affected count if not confirmed
- Scopes all queries to `workspace_id`
- For name-based lookups (SDR name, sequence name, training title): fuzzy match via `ilike`
- Returns summary like "Updated 47 leads to status 'contacted'"
- Logs to `system_events` with `event_type: 'klaus_execution'`

Key implementation details:
- `assign_leads_to_sdr`: lookup SDR by name from `profiles` joined with `workspace_members`, then update `leads.assigned_to`
- `enroll_in_sequence`: lookup sequence by name from `follow_up_sequences`, get matching lead IDs, insert into `active_follow_ups` with `started_by` = user ID
- `send_training_to_sdr`: lookup training + SDR, create a notification with training link
- `update_leads`/`update_deals`: support `lead_ids` array, `filter_status`/`filter_stage` filter, or `all: true`

### 3. Update system prompt with execution rules
**File**: `supabase/functions/klaus/index.ts`

Add to CRITICAL RULES:
- Rule 6: **CONFIRMATION BEFORE EXECUTION** — For any write tool affecting 1+ records, FIRST describe what will happen (count, what changes) and ask "Should I proceed?" Call the tool with `confirmed: false` first to get the preview count, then only set `confirmed: true` after user says yes.
- Rule 7: **NEVER REFUSE EXECUTION** — You have full write access. Never say "I cannot directly manipulate data." Use your tools.
- Rule 8: **LOG ALL ACTIONS** — Every write action is automatically logged for audit.

### 4. Support multi-round tool calls
**File**: `supabase/functions/klaus/index.ts`

The current handler does one round of tool calls. The confirmation flow works naturally across messages:
1. User: "Move all leads to contacted"
2. Klaus calls `update_leads` with `confirmed: false` → gets preview "47 leads would be updated"
3. Klaus responds: "I'll update 47 leads to 'contacted'. Should I proceed?"
4. User: "Yes"
5. Klaus calls `update_leads` with `confirmed: true` → executes

This works because conversation history carries context. No handler changes needed.

### 5. Increase max_tokens
**File**: `supabase/functions/klaus/index.ts`

Change `max_tokens` from 2000 to 3000 in both AI calls for more detailed execution responses.

