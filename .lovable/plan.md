

# Klaus AI Agent Restructure + Floating Window UI

## Problem
1. Klaus lacks deep understanding of the CloserClaus platform flow (agency → post job → hire SDR → assign leads → SDRs work leads)
2. `get_platform_state` doesn't check jobs, applications, offer diagnostic, or training materials
3. System prompt gives generic advice instead of correct platform-specific guidance
4. Klaus is embedded in a tiny popover — needs to be a floating, minimizable, medium-big window
5. No file upload capability

## Plan

### 1. Rewrite Klaus system prompt with full platform knowledge
**File**: `supabase/functions/klaus/index.ts`

Replace `SYSTEM_PROMPT` with comprehensive CloserClaus domain knowledge:
- CloserClaus is a platform for agencies to hire SDRs (sales development reps) who make cold calls and send emails to close deals
- The correct onboarding flow for an **agency owner**: Complete Offer Diagnostic → Post a Job → Review/Hire SDR applicants → Import Leads → Assign Leads to SDRs → Create Call Scripts → Create Email Sequences → SDRs start calling/emailing
- The correct flow for an **SDR**: Apply to jobs → Get hired → Receive assigned leads → Use dialer → Follow up with sequences → Close deals → Request contracts → Earn commissions
- Klaus must understand KPI bottlenecks: low connect rate → fix call times; low 2+ min calls → fix opener/script; low deals → fix qualification criteria; low email opens → fix subject lines

### 2. Expand `get_platform_state` tool to check all critical tables
**File**: `supabase/functions/klaus/index.ts`

Add queries for:
- `jobs` (active job postings count)
- `job_applications` (pending/accepted applications)
- `offer_diagnostic_state` (whether diagnostic is completed)
- `training_materials` (training content available)
- `workspace_members` with profiles (actual SDR names and hire status)
- Leads with `assigned_to` null vs assigned (unassigned lead count)

Update next-steps logic to follow correct priority order:
1. No offer diagnostic → "Complete your Offer Diagnostic first"
2. No jobs posted → "Post a job to start hiring SDRs"
3. Jobs but no applications/hires → "Review SDR applications"
4. No leads → "Import leads"
5. Leads but none assigned → "Assign leads to your SDRs"
6. No scripts → "Create call scripts"
7. No sequences → "Set up email sequences"
8. Everything set but no calls → "Your SDRs should start dialing"

### 3. Add new tools for jobs, applications, offer diagnostic, and training
**File**: `supabase/functions/klaus/index.ts`

New tool definitions and executors:
- `query_jobs` — list/count job postings
- `query_applications` — list/count job applications with status
- `query_offer_diagnostic` — get offer diagnostic state and recommendations
- `query_training` — list training materials
- `query_unassigned_leads` — count leads with no `assigned_to`
- `analyze_bottleneck` — comprehensive KPI analysis: connect rate, 2+ min call rate, deal conversion, email open rate, and returns the top bottleneck with actionable advice

### 4. Replace HelpWidget popover with floating window for Klaus
**Files**: `src/components/help/HelpWidget.tsx`, `src/components/klaus/KlausChat.tsx`

- When "Ask Klaus" is clicked, open a **floating draggable window** (not a popover) that is:
  - Medium-big size (~480px wide, ~600px tall)
  - Positioned bottom-right
  - Minimizable to a small bar/pill
  - Has a proper header with minimize/close buttons
  - Stays open while navigating the platform
- Keep other help options (bug report, feature request) in the popover
- Klaus window rendered via a portal at root level so it floats above everything

### 5. Add file upload to Klaus chat
**File**: `src/components/klaus/KlausChat.tsx`

- Add a paperclip/attachment button next to the input
- Support file selection (CSV, images, PDFs)
- For CSV files: read content client-side and include in the message to Klaus as context
- For images: upload to storage and include URL reference
- Show attached file name as a chip before sending

### 6. Update KlausChat UI for the floating window
**File**: `src/components/klaus/KlausChat.tsx`

- Remove the `onBack` prop pattern (no longer in popover)
- Add minimize/maximize state
- Suggested quick-action chips at bottom (e.g., "What should I do next?", "Show my KPIs", "Who's my top SDR?")
- Better empty state with platform-aware suggestions

## Technical Details

### Floating Window Implementation
- Use `position: fixed` with `z-50` and `bottom-20 right-4` positioning
- State managed in `HelpWidget` — `klausOpen` boolean + `klausMinimized` boolean
- When minimized: render a small pill with Klaus icon + "Klaus" text, clickable to restore
- The floating window is a separate component rendered outside the Popover

### System Prompt Key Section (abbreviated)
```
CloserClaus is a sales agency management platform. Agencies hire SDRs 
(Sales Development Reps) to cold-call and email prospects on their behalf.

CORRECT ONBOARDING FLOW FOR AGENCY OWNERS:
1. Complete Offer Diagnostic (defines your offer, ICP, pricing)
2. Post a Job (to attract SDRs)
3. Review & hire SDR applicants
4. Import leads to CRM
5. Assign leads to SDRs
6. Create call scripts (or use Script Builder from diagnostic)
7. Create email follow-up sequences
8. SDRs start dialing and emailing

WHEN ANALYZING PERFORMANCE BOTTLENECKS:
- Low connect rate (<15%) → Calling wrong times or bad phone data
- Low 2+ min calls (<30% of connects) → Weak opener, fix script
- Low meetings/deals → Weak qualification or pitch
- Low email opens (<20%) → Fix subject lines
- Low email replies (<2%) → Fix email copy/personalization
```

### Bottleneck Analyzer Tool
The `analyze_bottleneck` tool will:
1. Pull call logs (last 30 days), calculate connect rate and 2+ min call percentage
2. Pull email logs, calculate open/reply rates
3. Pull deal conversion rate
4. Compare against benchmarks
5. Return the #1 bottleneck with specific advice

