

## Issues Identified

### 1. Hard-coded limits block large scrapes
- Line 45: `maxResults` has `max: 500` in LinkedIn Jobs catalog
- Line 76: `maxItems` has `max: 500` in Indeed Jobs
- Line 105: `maxCrawledPlacesPerSearch` has `max: 3000` in Google Maps
- Lines 293-295: `buildGenericInput` enforces these `max` values via `Math.min`
- Lines 529-537: Plan generation rejects `estimated_rows > 3000`
- Lines 547-555: Plan generation rejects `creditsToCharge > 200`

### 2. AI planner only picks ONE source
The system prompt (line 389) says: *"You may suggest multiple sources by returning a SINGLE plan with the BEST-fit source."* For a hiring intent query, the AI picks `linkedin_jobs` and never also scrapes `indeed_jobs`. The user expects both sources to be queried automatically.

### 3. Multi-source execution requires different input schemas per actor
Each actor has different field names (`keyword` vs `search`, `maxResults` vs `maxItems`, `timePosted` vs `datePosted`). A multi-source execution must build separate inputs per actor using each actor's catalog entry.

---

## Plan

### A. Remove artificial limits

In `ACTOR_CATALOG`, remove all `max` properties from `inputSchema` entries. They artificially cap results. The user controls volume via their prompt, and credits act as the natural throttle.

Remove the two hard rejections in `handleGeneratePlan`:
- Remove the `estimated_rows > 3000` block (lines 529-537)
- Remove the `creditsToCharge > 200` block (lines 547-555)

In `buildGenericInput`, remove the `Math.min` enforcement (lines 293-295) since there are no more `max` values.

### B. Multi-source plan generation

Change the AI planner prompt and response format to support returning **multiple sources** when appropriate:

- Update the prompt to instruct: *"For hiring intent queries, return plans for BOTH linkedin_jobs AND indeed_jobs. For local business queries, return plans for BOTH google_maps AND yelp. Return a JSON array of plan objects, one per source. If only one source is appropriate, return a single-element array."*
- Update the response schema from a single object to an array of plan objects, each with its own `source`, `search_params`, `filters`, and `ai_classification`.

### C. Multi-source execution

Update `handleExecuteSignal` to iterate over the plan array (or wrap a single plan in an array for backward compatibility):

For each source plan:
1. Resolve the actor from `ACTOR_CATALOG` using its `source` key
2. Split keywords using `splitCompoundKeywords` (already implemented)
3. Build input using `buildGenericInput` with that actor's schema
4. Execute Apify calls, normalize with that actor's `outputFields`
5. Merge all normalized results into a single pool

Then apply filters, AI classification, dedup, and storage once on the merged pool.

### D. Cost estimation update

Update `handleGeneratePlan` to sum estimated costs across all source plans. Store the array of plans in `signal_plan` (the column is `jsonb` so it accepts arrays).

### E. Backward compatibility

In `handleExecuteSignal`, check if `signal_plan` is an array or object. If object (old format), wrap in `[plan]` so the loop works uniformly.

---

### Files to change

| File | Changes |
|------|---------|
| `supabase/functions/signal-planner/index.ts` | Remove `max` from catalog, remove hard limits, update AI prompt for multi-source, update plan generation to handle arrays, update execution to loop over sources |
| `supabase/functions/process-daily-signals/index.ts` | Same backward-compat wrapper for multi-source plans in daily processing |
| `src/hooks/useSignalScraper.ts` | Update `SignalPlan` type to support array, update estimation display for multi-source |

