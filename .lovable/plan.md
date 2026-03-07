
Goal: make the “Records to scan” estimate always respect the chosen “Max results per source” (100 in your case), including reruns.

What I verified
- The latest request sent to `signal-planner` did not include `advanced_settings` at all.
- Recent planned runs in the database show Stage 1 params present, but `signal_plan.pipeline[0].expected_output_count` is missing.
- Current UI has two generation paths:
  1) Main “Generate Pipeline” button → includes `advanced_settings`
  2) History rerun action (`RotateCcw`) → currently calls `generatePlan({ query })` without `advanced_settings`

Root cause
- You’re hitting a generation path that omits `advanced_settings` (rerun flow), so planner falls back to uncapped actor defaults (often ~500 each source => ~1000 total).
- Planner normalization is still brittle when limits arrive as strings or missing numeric keys, so fallback can still land on 1000.

Implementation plan

1) Fix rerun flow to pass advanced settings
- File: `src/components/leads/SignalScraperTab.tsx`
- Update `handleRerun` to call:
  - `generatePlan({ query: run.signal_query, advanced_settings: advancedSettings })`
- This ensures the slider value (100) is honored no matter where plan generation is triggered.

2) Harden planner-side cap inference (defensive)
- File: `supabase/functions/signal-planner/index.ts`
- Improve `inferRowCapFromParams` to parse numeric strings (`"100"`) in addition to numbers.
- Keep/extend supported cap keys so inference works across actor variants.
- Ensure Stage 1 `expected_output_count` is always written after normalization (even if advanced settings are absent) by deriving from actor params when possible.

3) Make estimator robust when Stage 1 count is absent
- File: `supabase/functions/signal-planner/index.ts`
- In `estimatePipelineCost`, if Stage 1 lacks `expected_output_count`, compute from `params_per_actor` caps before any fallback.
- Only use 1000 as true last resort when no inferable cap exists.

4) Add lightweight runtime logging for diagnosis
- File: `supabase/functions/signal-planner/index.ts`
- Log (non-sensitive) whether `advanced_settings` was received and the resolved `maxCap`.
- Log computed Stage 1 `expected_output_count` used for estimation.

5) Validation checklist
- Generate from main button with max=100:
  - request contains `advanced_settings.max_results_per_source = 100`
  - response `estimation.estimated_rows` reflects cap (e.g., ~200 for 2 sources)
- Rerun from history with max=100:
  - same expected behavior as above
- Confirm latest `signal_runs.signal_plan.pipeline[0].expected_output_count` is populated (not null)
- Sanity test with max=500 to confirm scaling remains correct.

Scope
- 2 files, no database migration required.
- Primary fix is UI rerun payload consistency; backend hardening prevents future regressions.
