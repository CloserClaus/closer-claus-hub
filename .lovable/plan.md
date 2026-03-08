

# Test Signal Scraper: Minimal Credit Run

## Approach

I'll invoke the `signal-planner` edge function with a very small, precise query and minimal settings to observe the full pipeline flow without burning significant credits.

### Test Parameters
- **Query**: `"Find plumbing companies in Austin Texas"` (local_business signal — simplest pipeline, fewest stages)
- **max_results_per_source**: `100` (minimum practical value)
- **ai_strictness**: `high` (filters aggressively, fewer leads to process)
- **date_range**: `past_week`

### Why This Query
- Local business signals typically produce a 2-stage pipeline (scrape Google Maps → enrich), which is the cheapest path
- Plumbing is a narrow niche so results will be small
- Avoids hiring_intent pipelines which require expensive people-enrichment stages

### Steps
1. **Generate plan** — call `signal-planner` with `action: generate_plan` to see what pipeline the AI designs
2. **Review the plan** — inspect the stages, actors selected, and estimated costs before executing
3. **Execute** — if the plan looks reasonable and cheap, trigger `action: execute_signal`
4. **Monitor** — poll `signal_runs` and `signal_leads` tables to track progress and inspect results
5. **Report** — check field coverage (all 6 mandatory fields), actor success, matching accuracy

### Credit Impact
- Apify cost for 100 Google Maps results: ~$0.50-1.00
- AI filtering (Gemini): negligible
- Total estimated: under $2 in Apify credits

### Files Involved (read-only inspection)
- `supabase/functions/signal-planner/index.ts` — plan generation
- `supabase/functions/process-signal-queue/index.ts` — execution
- Database tables: `signal_runs`, `signal_leads`

