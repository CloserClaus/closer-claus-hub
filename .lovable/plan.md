

# Validate-As-You-Build Architecture

## Current Problem
The planner generates a full pipeline in one shot, picks actors via pre-flight tests that can't work for enrichment stages (no input data exists yet), and hopes everything fits together at execution time. This causes: pre-flight failures on stages 3-6, data flow mismatches, and wasted API costs.

## New Architecture: Multi-Phase State Machine

The core idea: planning becomes an **iterative, stateful process** that validates each stage sequentially with real data before committing the next stage. Instead of one function call, planning happens across multiple invocations, with state persisted in the `signal_runs` table.

### Planning Flow (per invocation of `signal-planner`)

```text
┌─────────────────────────────────────────────────────┐
│  PHASE: plan_generating                             │
│  AI generates the full logical flow (categories,    │
│  filters, sequence). No actors selected yet.        │
│  → Save plan skeleton to DB                         │
│  → Set phase: plan_validating_stage_1               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  PHASE: plan_validating_stage_N                     │
│  1. Discover actors for stage N's category          │
│  2. Pick top candidate by quality score             │
│  3. Build input (stage 1: from query params,        │
│     stage 2+: from stage N-1's test output)         │
│  4. Run actor with maxItems: 3-5 (micro test)       │
│  → Save run ref, set phase: plan_testing_stage_N    │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  PHASE: plan_testing_stage_N                        │
│  1. Poll Apify run status                           │
│  2. If still running → return (next cron picks up)  │
│  3. If succeeded:                                   │
│     a. Collect results, normalize                   │
│     b. Check: does output contain fields needed     │
│        by stage N+1's input_from?                   │
│     c. Store sample output in plan for next stage   │
│  4. If failed or output incompatible:               │
│     a. Try next actor candidate (up to 3)           │
│     b. If all fail: AI regenerates flow from        │
│        this stage onward                            │
│  → Set phase: plan_validating_stage_(N+1) or done   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  PHASE: plan_validated                              │
│  All stages validated. Compute cost estimate.       │
│  Return full plan + estimation to frontend.         │
└─────────────────────────────────────────────────────┘
```

### Execution Flow Enhancement

During execution (in `process-signal-queue`), after each stage completes collecting:

1. Take a **5% sample** (min 10, max 50) of the stage's output
2. AI evaluates: "Does this data match the user's intent for this stage?"
3. If **YES** → advance to next stage
4. If **NO** → attempt one correction cycle:
   - If stage 1: try backup actor or corrected query (existing logic, mostly works)
   - If enrichment stage: try next backup actor
   - If still fails after correction: abort with actionable message

This part already partially exists in `qualityCheckStage()` — we enhance it to run **after every stage** instead of selectively.

## Detailed Changes

### File 1: `supabase/functions/signal-planner/index.ts`

**A. New DB fields needed** (migration):
- `signal_runs.plan_phase` — tracks planning state machine position (e.g., `plan_validating_stage_2`)
- `signal_runs.plan_test_runs` — JSON array storing micro test run refs per stage
- `signal_runs.plan_stage_outputs` — JSON object storing sample output per validated stage (used as input for next stage's test)

**B. Refactor `handleGeneratePlan` into a state machine router:**

The function checks `plan_phase` on the run:
- `null` or `plan_generating` → call AI to generate logical flow skeleton, save it, set phase to `plan_validating_stage_1`
- `plan_validating_stage_N` → discover actors for stage N, start micro test run, set phase to `plan_testing_stage_N`
- `plan_testing_stage_N` → poll test run, validate output, advance or retry
- `plan_validated` → compute cost estimate, return final plan

For the **first call** (no existing run), create the run with `status: planning` and return `{ run_id, status: "planning", phase: "plan_validating_stage_1" }`. The frontend polls until `plan_validated`.

**C. Remove `resolveActorsForPipeline` and `preflightValidateActor`:**
Replace with stage-by-stage validation inside the state machine. Each stage gets:
1. Actor discovery (existing `discoverActors()`)
2. Micro test run (maxItems: 3-5, 45s timeout)
3. Output validation against next stage's `input_from` requirements
4. Sample output stored for next stage's test input

**D. Add `buildTestInput` helper for stages 2+:**
For enrichment stages, takes the sample output from the previous stage's test and extracts the `input_from` field values to build real test input. E.g., if stage 2 needs `company_name` from stage 1, it uses the 3-5 company names from stage 1's test output.

**E. Add flow regeneration on validation failure:**
If a stage fails validation after trying 3 actors, call AI with context: "Stage N failed because [reason]. The stages before it produce [fields]. Redesign stages N onwards." This replaces the failing portion of the pipeline.

**F. Skip ai_filter stages during planning validation:**
AI filter stages don't need actor validation — they're executed by the AI gateway. Mark them as auto-validated and advance.

### File 2: `src/hooks/useSignalScraper.ts`

**G. Add polling for plan validation:**

Currently, `generatePlan` fires one request and expects the complete plan back. Change to:
1. First call returns `{ run_id, status: "planning", phase: "plan_validating_stage_1" }`
2. Frontend polls `signal-planner` with `{ action: "check_plan_status", run_id }` every 5 seconds
3. Each poll triggers the next state machine step on the backend
4. UI shows progress: "Validating Stage 1: LinkedIn Jobs Scraper..." → "Validating Stage 2: Company Enrichment..."
5. When `plan_validated`, the full plan + estimation is returned

### File 3: `src/components/leads/SignalScraperTab.tsx`

**H. Add planning progress UI:**

Show a stepped progress indicator during plan generation:
- Stage badges showing validation status (pending / testing / validated / failed)
- Real-time phase updates from polling
- If a stage fails and triggers regeneration, show "Adjusting pipeline..."

### File 4: `supabase/functions/process-signal-queue/index.ts`

**I. Enforce quality check after EVERY stage:**

Move the `pipelineValidating` call to run after every `collecting` phase, not just selectively. The existing `qualityCheckStage` function already handles this well — just ensure it's always triggered.

**J. Add execution-time sample validation:**

After each stage collects data, before advancing:
1. Sample 5% of results (min 10, max 50)
2. AI checks if the output matches the stage's expected purpose
3. If quality is LOW or USELESS: try backup actor, then abort if still bad
4. Log the validation result in `pipeline_adjustments`

## Migration

```sql
ALTER TABLE signal_runs 
ADD COLUMN IF NOT EXISTS plan_phase text,
ADD COLUMN IF NOT EXISTS plan_test_runs jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS plan_stage_outputs jsonb DEFAULT '{}'::jsonb;
```

## Timeout Strategy

Each planning invocation does **one state transition** only:
- Generate flow: ~10s (AI call)
- Validate stage: ~5s (discover actors + start test run)  
- Test stage: ~3s (poll status) or ~45s (if run completes this cycle)

The frontend polls every 5s, each poll triggers the next step. Total planning time for a 6-stage pipeline: ~2-4 minutes (mostly waiting for Apify test runs).

## Cost Impact

- Planning micro tests: ~$0.003-0.005 per stage (maxItems: 3-5)
- 6-stage pipeline: ~$0.02 total planning cost
- This is negligible compared to the full execution cost ($0.50-5.00)

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Refactor into state machine, remove batch pre-flight, add per-stage validation with real data |
| `src/hooks/useSignalScraper.ts` | Add polling loop for plan validation progress |
| `src/components/leads/SignalScraperTab.tsx` | Add planning progress UI with stage-by-stage status |
| `supabase/functions/process-signal-queue/index.ts` | Enforce quality check after every stage, add sample validation |
| DB migration | Add `plan_phase`, `plan_test_runs`, `plan_stage_outputs` columns |

