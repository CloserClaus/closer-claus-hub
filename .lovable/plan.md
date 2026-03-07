
Goal: Make “Records to scan” respect “Max results per source” (e.g., 100) every time.

What I found
- The UI reads `estimation.estimated_rows` from the planner response.
- Planner cost/row estimation currently defaults Stage 1 to `1000` when `stage.expected_output_count` is missing:
  - `currentCount = stage.expected_output_count || 1000`
- Recent runs confirm Stage 1 often has capped actor params (`limit: 100`, `max_results: 100`) but `expected_output_count` is null, so estimate still shows 1000.
- Cap logic is also incomplete: it caps `count/limit/maxItems/maxResults...` but misses common keys like `max_results`.

Implementation plan
1. Add a single normalization helper in `supabase/functions/signal-planner/index.ts`
- New helper to infer per-actor row cap from params using a broader field list:
  - `count, limit, maxItems, maxResults, max_results, rows, row_count, results, numResults`
- For Stage 1 scrape stages:
  - Derive each actor’s expected rows from its params.
  - Apply `max_results_per_source` cap per actor.
  - Sum actor estimates for stage total.
  - If nothing inferable, fallback to `max_results_per_source` (if provided), else existing value, else 1000.

2. Always write Stage 1 `expected_output_count`
- During advanced-settings application, set `stage.expected_output_count` even when it was missing.
- This guarantees the estimator and UI use the capped value instead of 1000 fallback.

3. Expand parameter cap coverage
- Update cap field list to include snake_case/common variants (`max_results`, `rows`, etc.) so actual runtime params and estimates stay aligned.

4. Harden estimator fallback path
- In `estimatePipelineCost`, if Stage 1 `expected_output_count` is still absent for any reason, derive from `params_per_actor` instead of jumping directly to 1000.
- Keeps estimate correct even if AI omits the field.

5. Verify with targeted checks
- Generate a new pipeline with max=100 and confirm:
  - `signal_plan.pipeline[0].expected_output_count` is populated (not null).
  - `estimation.estimated_rows` is no longer 1000 and matches capped logic (typically ~100 per source, summed across Stage 1 actors).
- Regression check with max=500 and max=2500 to confirm scaling works.

Technical details
- File to update: `supabase/functions/signal-planner/index.ts` only.
- No schema or migration changes needed.
- Primary bug is not in UI rendering; it is planner-side estimation normalization.
- Secondary consistency fix is broader cap-field mapping so estimation and execution stay synchronized.
