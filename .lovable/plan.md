

## Signal Run `027618b2` — Full Autopsy

### User Input
- **Signal Name**: "Small marketing agency owners hiring sales reps"
- **Query**: "Search for founders/Owners/CEO's of marketing/Branding/SEO/Lead Gen agencies with 1-10 employees hiring for sales reps. Exclude sales/outbound agencies."
- **Estimated Cost**: 15 credits
- **Estimated Leads**: 50

---

### Pipeline Created by AI Planner (6 stages)

| Stage | Type | Name | Actors | Key Params |
|-------|------|------|--------|------------|
| 1 | scrape | Discover agencies hiring sales reps | `linkedin_jobs`, `indeed_jobs` | LinkedIn: 200 results, `splitByLocation: true`, Indeed: 200 results, "sales representative OR account executive" |
| 2 | ai_filter | Filter for specific agency types | — | Prompt: "Is this a Marketing/Branding/SEO/LeadGen agency? Exclude sales agencies, call centers, corporations" |
| 3 | scrape | Enrich company data and headcount | `linkedin_companies` | `input_from: company_linkedin_url` |
| 4 | ai_filter | Filter for 1-10 employee headcount | — | Prompt: "Does this company have 1-10 employees?" |
| 5 | scrape | Find Founders and CEOs | `linkedin_people` | `input_from: company_linkedin_url`, search titles: Founder, Owner, CEO, Managing Director, Principal |
| 6 | scrape | Get contact information | `contact_enrichment` | `input_from: website` |

---

### What Actually Happened — Stage by Stage

**Stage 1 (Scrape — Job Boards)**:
- Two actors were launched: `linkedin_jobs` and `indeed_jobs`
- **CRITICAL**: Despite the plan specifying `splitByLocation: true`, the code correctly overrides this to `false` (line 873). However, the run's `apify_run_ids` is now `[]` — meaning either:
  - Both actors returned 0 results (possible: LinkedIn Jobs frequently returns nothing for broad US searches), OR
  - The runs completed but the refs were cleared during collection
- **Result**: 0 leads inserted. The `signal_leads` table has 0 rows for this run.

**Stage 2 (AI Filter)**: Ran on 0 leads → passed 0

**Stage 3 (LinkedIn Companies Enrichment)**: `input_from: company_linkedin_url` — 0 leads had LinkedIn URLs → 0 enriched

**Stage 4 (AI Filter)**: 0 leads → 0 passed

**Stage 5 (LinkedIn People)**: 0 leads → 0 people found

**Stage 6 (Contact Enrichment)**: Log confirms: `"Stage 6: No leads to enrich, skipping"` → Finalized with 0 leads, 0 credits.

---

### Root Cause: Stage 1 Produced Zero Data

The pipeline went through all 6 stages on an empty dataset. The fundamental failure is that **Stage 1 scraped 0 results** from both LinkedIn Jobs and Indeed.

Possible reasons:
1. **LinkedIn Jobs actor failure**: This actor has been unreliable — the previous run (`7aaf0df5`) also got 0 from LinkedIn Jobs (all 562 leads came from Indeed only)
2. **Indeed actor returning 0**: This is new. The query "sales representative OR account executive" with `location: "United States"` worked before (562 results in the prior run). Possible causes: rate limiting, API changes, or the actor failing silently
3. **Apify capacity/billing issue**: All runs may have failed to start (returned FAILED status), and since `hasSuccessfulStart` was false, the pipeline jumped directly to `stage_1_validating`

### Critical Bug: No Zero-Result Abort

The **quality validation system** (`pipelineQualityCheck`) was supposed to catch this — but `pipeline_adjustments` is `[]`, meaning the quality check either:
- Never ran (the validating phase was skipped), OR
- Ran but found 0 sample leads and returned without adding any adjustments

Looking at the code flow: when `collectedIndex >= stageRefs.length` AND there are no successful refs, it goes to `stage_N_validating`. But the quality check samples leads from `signal_leads` — with 0 leads, the sample is empty, and the quality check likely returned a benign result instead of aborting.

---

### What the Previous Changes Did NOT Fix

1. **Dynamic actor discovery** — The planner still used the hardcoded `linkedin_jobs` and `indeed_jobs` actors (the `discoverActors` function was added but the planner may not be calling it, or it fell back to the catalog)
2. **Output-aware flow planning** — Stage 3 still uses `input_from: company_linkedin_url` even though Indeed (the only reliable source) doesn't provide LinkedIn URLs. The `validateDataFlow` check either isn't running or isn't catching this
3. **Quality validation** — The quality check didn't abort on 0 results at stage 1. The run proceeded through all 6 stages on empty data
4. **No fallback when both actors return 0** — There's no retry with different actors or alternative search terms

---

### What Needs to Be Fixed

**Fix 1: Hard abort when Stage 1 returns 0 leads**
In `pipelineStageValidating` (or better, in `pipelineScrapeCollecting` after all datasets are collected): if `stageNum === 1` and the count of leads for this run is 0, immediately fail the run with a clear message like "No results found from job boards. Try broadening your search terms or checking a different time range."

**Fix 2: Quality check must handle 0-lead samples**
The `pipelineQualityCheck` function currently samples 15 leads. If there are 0 leads, it should return `{ quality: "USELESS", suggestedAction: "abort", reason: "Stage produced 0 results" }` instead of whatever it returns now.

**Fix 3: Verify dynamic actor discovery is actually being called**
Check `signal-planner/index.ts` to confirm `discoverActors()` is invoked during plan generation and its results are actually passed to the AI. The plan for this run used the exact same hardcoded actor selection pattern as before the changes.

**Fix 4: Verify validateDataFlow is running**
The plan has Stage 3 with `input_from: company_linkedin_url` chained after Indeed (which outputs no LinkedIn URLs). The data flow validator should have caught this and injected a LinkedIn URL discovery stage — but it clearly didn't.

### Files to Modify
- `supabase/functions/process-signal-queue/index.ts` — Fix zero-result handling in quality check and collection
- `supabase/functions/signal-planner/index.ts` — Verify and fix dynamic actor discovery + data flow validation integration

