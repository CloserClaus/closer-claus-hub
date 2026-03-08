

# Signal Scraper Autopsy: Honest Assessment

## What It's Supposed To Do

Find companies showing **active buying signals** (hiring, poor reviews, new business, recently funded, etc.) → scrape them → filter them → find **decision makers** at those companies → deliver enriched leads with name, title, LinkedIn, website, industry, employee count.

## Architecture Summary

```text
User Query → Signal Planner (AI designs pipeline) → Process Queue (executes stages)

Stage 1: Scrape (Apify actors: Indeed, LinkedIn Jobs, Google Maps, etc.)
Stage 2: AI Filter (Gemini classifies relevance)
Stage 3: Enrich (company data, LinkedIn URLs)
Stage 4: People (find decision makers)
Stage 5: Finalize (dedup, cost, notify)
```

## What Works Well

1. **Dynamic actor discovery** — queries Apify Store in real-time, fetches input schemas, caches for 7 days. No hardcoded actor catalog. This is genuinely adaptive.
2. **Quality validation between stages** — AI rates data quality (HIGH/MEDIUM/LOW/USELESS), can reconfigure or abort mid-run. Smart safeguard.
3. **Resilience patterns** — fallback actors per subcategory, capacity-error deferral with backoff, container-kill-proof retry counting, per-run timeouts.
4. **Dedup** — 4-tier matching (domain, name, fuzzy, LinkedIn), cross-workspace dedup keys, job-board domain exclusion list.
5. **Cost model** — estimates before execution, charges after based on actual work.

## Critical Problems That Will Cause Failures

### Problem 1: Person enrichment matching is fragile (HIGH SEVERITY)

When people_data actors return results, the system matches people back to leads using company name fuzzy matching (lines 1493-1523 of process-signal-queue). This is a **weak link**:

- A people search for "CEO at Acme Corp" returns a LinkedIn person whose company is listed as "Acme Corporation" or "ACME" — the fuzzy match (`includes()`) may work, but "Acme" also matches "Acme Holdings", "Acme Digital", etc.
- If the person's `companyUrl`/`website` is missing from the LinkedIn scrape (common), it falls back to name-only matching.
- **Result**: Decision makers get assigned to wrong companies, or aren't matched at all.

### Problem 2: People search URL construction is brittle (HIGH SEVERITY)

Lines 1149-1170: For people searches, the system builds LinkedIn search URLs like:
```
https://www.linkedin.com/search/results/people/?keywords=CEO%20OR%20Founder%20Acme%20Corp
```

This is NOT how LinkedIn People Search actors typically work. Most Apify LinkedIn people scrapers expect structured input (`company`, `title`, `firstName`, etc.), not raw search URLs. The system is passing a URL to an actor that likely expects JSON parameters. If the actor's schema wasn't fetched (common for dynamically discovered actors), these URLs get passed as-is — likely returning garbage or nothing.

### Problem 3: Enrichment stages match by domain only (MEDIUM SEVERITY)

Lines 1536-1561: Non-people enrichment stages match results back to leads using `domain` only. If a lead has no website (just company name from a job board), it can never be enriched. Job board leads frequently lack websites.

### Problem 4: The AI planner can hallucinate actor keys (MEDIUM SEVERITY)

The planner sees a catalog of discovered actors and selects keys. Despite validation (lines 1322-1339), if the AI generates a key that's close but not exact (e.g., `linkedin_jobs_scraper` vs `linkedin_jobs_scraper_v2`), the validation removes it and falls back to a `web_search` actor — which is completely wrong for the stage's purpose.

### Problem 5: Stage 1 collecting doesn't populate `company_linkedin_url` correctly (MEDIUM SEVERITY)

Line 1448: `company_linkedin_url: item.linkedin || null` — but `item.linkedin` maps to `companyLinkedinUrl` from the UNIVERSAL_OUTPUT_PATHS. For Indeed results, `companyLinkedinUrl` is often the company's LinkedIn page, but for Google Maps or generic scrapers, `linkedin` may be empty. The field name aliasing between `linkedin` (company) and `linkedin_profile` (person) is confusing and error-prone.

### Problem 6: No retry for individual stage failures (MEDIUM SEVERITY)

If a people_data actor returns 0 results (actor didn't find anyone), the stage silently moves on. There's no mechanism to retry with different search titles, try a different people-finding actor, or fall back to a contact enrichment service. The pipeline just finishes with empty `contact_name` fields.

### Problem 7: Orphan cleanup is too aggressive (LOW-MEDIUM SEVERITY)

Lines 1738-1761: If `stage1Count > advancedCount * 2`, it deletes ALL stage_1 leads. But in a hiring_intent pipeline, only companies that passed the AI filter advance. The "orphans" are the filtered-out leads — they're supposed to be deleted by the AI filter, not by finalization. This double-cleanup is fine, but if the AI filter malfunctions (returns all `true`), no leads advance past stage_1 labeling, and this logic deletes everything.

## Structural Issues

### The "everything is an edge function" constraint

Both `signal-planner` (1486 lines) and `process-signal-queue` (2216 lines) are single massive files. Edge functions have a 60-second execution limit. The queue processor handles this with incremental processing (one dataset per invocation), but complex pipelines with 5+ stages need many cron invocations to complete. A single stage with a slow Apify actor can stall the entire pipeline for hours.

### AI-on-AI-on-AI reliability

The system uses AI at 4 points:
1. **Plan generation** (Gemini designs the pipeline)
2. **Quality validation** (Gemini rates data quality)
3. **Pipeline reconfiguration** (Gemini redesigns failing pipelines)
4. **Lead classification** (Gemini filters leads)

Each AI call can fail, return malformed JSON, or make poor decisions. The system handles JSON parsing failures gracefully, but **bad AI decisions compound** — a poorly designed pipeline → low quality data → unnecessary reconfiguration → dropped stages → missing fields.

## Verdict: Will It Work As Intended?

**Partially.** Here's what will happen in practice:

- **Stage 1 (scraping)**: Will work ~80% of the time. The role_filter separation fixed the biggest issue. Actor discovery and fallback are solid.
- **Stage 2 (AI filtering)**: Will work ~90% of the time. Gemini is good at classification.
- **Stage 3-4 (enrichment + people)**: **Will fail ~50% of the time.** The person-matching logic is too fragile, LinkedIn search URL construction doesn't match actor input schemas, and enrichment-by-domain-only misses leads without websites.
- **End-to-end success** (all 6 mandatory fields populated): **~30-40% of runs** will produce fully enriched leads with decision maker names and LinkedIn profiles.

## Recommended Fixes (Priority Order)

1. **Fix people search input construction** — detect whether the people_data actor expects URLs or structured params, and build input accordingly. This is the #1 blocker for decision maker discovery.
2. **Strengthen person-to-lead matching** — use a scoring system (domain match = 100, exact name = 80, fuzzy = 50, LinkedIn company URL = 90) instead of first-match. Require minimum score of 70.
3. **Add enrichment-by-company-name fallback** — when domain is missing, match enrichment results by company name (like people_data already does).
4. **Add stage-level retry with alternative actors** — if a people_data stage returns <20% match rate, retry with a different people actor or different search titles.
5. **Split the edge functions** — extract quality validation, people matching, and enrichment into separate utility functions or even separate edge functions to reduce blast radius.

