

# Fix: Data-Aware AI Filter Placement in Pipeline Planner

## Problem
The planner prompt instructs the AI to "filter aggressively BEFORE expensive enrichment" (line 307) and the flow template (lines 194-200) places AI filters right after Stage 1 discovery. But Stage 1 sources (e.g., LinkedIn Jobs) only produce basic fields like `company_name`, `title`, `location`. The AI filter then tries to classify by criteria like "marketing agency with 1-10 employees" — data that doesn't exist yet.

This is not a filter strictness issue. It's a **flow logic issue**: the planner places filters before the data they need has been scraped.

## Root Cause (in the prompt at `buildPipelinePlannerPrompt()`)
1. The flow template says "Filter → Enrich → Filter again" but doesn't explain **what each filter can check** based on available data
2. The `ai_filter` schema has no `requires_fields` property — so the validator can't catch filters that reference unscraped data
3. `validateDataFlow()` only checks `input_from` on scrape stages, completely ignoring filter stages
4. The "COST EFFECTIVENESS" rule "filter aggressively BEFORE enrichment" causes the AI to place premature filters

## Changes

### 1. Rewrite the flow design rules in the planner prompt (`buildPipelinePlannerPrompt()`, lines 181-366)

Replace the current Step 2 flow template and add a new section: **"AI FILTER DATA-AVAILABILITY RULES"**

Key new instructions:
- **An AI filter can ONLY filter on fields that prior scrape stages have actually produced.** Reference the output fields listed per category.
- After a job board scrape (hiring_intent), the only available fields are: `company_name`, `title`, `location`, `description`. The filter can ONLY check job-title relevance and basic keyword matching on company name/description. It CANNOT check industry type, headcount, or company specifics.
- To filter by company type (e.g., "is this a marketing agency?"), you MUST first scrape the company website or LinkedIn company page, THEN filter.
- To filter by headcount/employee_count, you MUST first scrape `company_data:linkedin`, THEN filter.
- Each `ai_filter` stage MUST include a `requires_fields` array declaring which fields the prompt depends on.

Replace the flow template:
```
1. Discovery (scrape the narrowest source first)
2. Lightweight filter (ONLY on fields the discovery stage outputs — e.g., job title relevance)
3. Enrich (scrape websites/LinkedIn company pages to get industry, headcount)
4. Deep filter (now you CAN filter by industry, company type, headcount)
5. People (find decision makers)
6. Contact (get email/phone)
```

Add a concrete example to the prompt showing correct vs incorrect flow:

```
WRONG: LinkedIn Jobs → AI Filter "is this a marketing agency with <50 employees?" → Enrich
(LinkedIn Jobs doesn't output industry classification or employee_count)

RIGHT: LinkedIn Jobs → AI Filter "is the job title a sales role?" → Scrape company websites → AI Filter "is this a marketing agency?" → Scrape company LinkedIn → AI Filter "does it have <50 employees?" → People → Contact
```

### 2. Add `requires_fields` to ai_filter schema (in prompt, lines 243-251)

Update the schema to:
```json
{
  "stage": "<number>",
  "name": "<human-readable stage name>",
  "type": "ai_filter",
  "prompt": "<classification prompt — ONLY reference fields listed in requires_fields>",
  "input_fields": ["company_name", "website", "industry"],
  "requires_fields": ["company_name", "industry"],
  "expected_pass_rate": 0.20
}
```

### 3. Extend `validateDataFlow()` to validate filter stages (lines 425-490)

Add a check: for each `ai_filter` stage, verify that every field in `requires_fields` has been produced by a prior scrape stage. If not, either:
- Inject an enrichment stage before the filter (e.g., insert `company_data:linkedin` before a filter that needs `employee_count`)
- Or reorder stages so enrichment precedes the filter

### 4. Remove contradictory "filter before enrichment" instruction

Remove line 307 ("ALWAYS filter aggressively BEFORE expensive enrichment") and replace with:
"Filter on available data ASAP — but only on fields that prior stages have actually produced. A filter on unscraped data wastes the entire pipeline."

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Rewrite flow rules in prompt, add `requires_fields` to ai_filter schema, extend `validateDataFlow()` to check filter data dependencies, add auto-injection of missing enrichment stages |

