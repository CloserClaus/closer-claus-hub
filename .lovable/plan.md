
Problem autopsy (why this is happening)

1) I confirmed your latest run saved `advanced_settings.max_results_per_source = 100`, but the run was estimated as:
- `estimated_rows = 25`
- `estimated_cost = 21`
So settings are reaching the backend, but estimation logic is drifting afterward.

2) The main break is in `signal-planner` data-flow validation:
- `validateDataFlow()` checks whether `input_from` is produced by earlier stages using `prevStage.expected_output_fields`.
- But `expected_output_fields` is never populated anywhere.
- Result: valid `input_from` values (like `company_name`, `website`) are falsely marked invalid and auto-removed (`input_from = null`).
- Logs already show this exact behavior:
  - “Stage 3 input_from field "company_name" not produced…”
  - “Stage 4 input_from field "website" not produced…”

3) That bad auto-fix cascades into wrong estimation:
- Estimator treats `!input_from` stages like discovery-like resets.
- Stage 1 gets capped to 100, then AI filter 25% reduces to 25, then later stages with null `input_from` keep/reset around 25.
- UI then shows “Records to scan = 25” (wrong semantic; should reflect Stage 1 discovery volume when capped to 100).

4) Secondary estimator instability:
- `inferRowCapFromParams` only checks a narrow key set (`maxItems`, `maxResults`, `maxCrawledPlacesPerSearch`).
- Many actors use other cap keys (`limit`, `count`, `rows`, etc.), so caps and estimates can silently diverge across different pipelines.

5) Advanced filtering appears to “fail” because broken `input_from` weakens true stage chaining (enrichment stages can run as if independent discovery), reducing both precision and interpretability.

Implementation plan

A) Fix data-flow validation so valid dependencies are preserved
- File: `supabase/functions/signal-planner/index.ts`
- Replace `expected_output_fields`-only check with produced-field inference from:
  1. `updates_fields` on each prior stage
  2. Verified actor output fields via `stage_category` lookup
  3. Alias normalization (`linkedin` ↔ `company_linkedin_url`, `linkedin_profile` ↔ `linkedin_profile_url`)
- Only null `input_from` when truly unresolvable.

B) Add deterministic fallback repair (not destructive nulling)
- If a scrape stage >1 has missing/invalid `input_from`, auto-map by stage type:
  - `people_data:*` → `company_name` (or `company_linkedin_url` when available)
  - `enrichment:contact` → `website`
  - `company_data:linkedin` → `company_linkedin_url`
- Append a warning note so UI can show “auto-repaired dependency”.

C) Correct estimation semantics
- Keep “Records to scan” tied to Stage 1 discovery volume (capped by advanced setting).
- Never let later enrichment stages overwrite discovery row count.
- Keep credits modeled per-stage, but compute using stable row flow (no discovery reset on stage>1 unless explicitly intended).

D) Harden cap inference for advanced settings
- Expand row-cap key detection to include common variants:
  - `count`, `limit`, `max_items`, `max_results`, `rows`, `numResults`, etc.
- Reuse the same inference helper in both cap-application and estimator paths to prevent drift.

E) Keep execution semantics aligned with planning
- Ensure stages with repaired `input_from` are treated as enrichment by the worker path (no accidental “discovery stage” behavior based on null input).
- This preserves advanced filtering quality and avoids stage chaining regressions.

F) Debug visibility in UI (small but high-value)
- Surface `data_flow_fixes` as warnings in pipeline preview so users see when the system repaired stage links.
- This makes “why estimate changed” transparent.

Validation plan (after implementation)

1) Generate with max=100 and strictness=medium on the same prompt:
- Expect `advanced_settings.max_results_per_source=100` in DB.
- Expect Stage 1 `expected_output_count` ≈ 100.
- Expect “Records to scan” ≈ 100 (not 25).

2) Confirm no false data-flow deletions:
- No logs saying Stage 3/4 input fields “not produced” when fields are present.

3) Verify estimation consistency across actor types:
- Run 2–3 prompts using different Stage 1 actor categories and confirm cap inference stays aligned.

4) End-to-end quality check:
- Ensure downstream enrichment stages preserve chaining and produce better field coverage (contact/profile/company fields) without dependency collapse.
