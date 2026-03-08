

# Fix Signal Scraper: Role Precision at Source + Mandatory Field Guarantees

## Problem Analysis

### Issue 1: Wrong roles returned despite actor capability
The planner generates `search_query` like `"marketing agency SDR OR advertising agency Sales Representative"` — but in `pipelineScrapeStarting()` (lines 970-1023), the keyword is passed to job board actors via generic field mapping. The actor's **role/title filtering capability** is never explicitly used. Job board actors like Indeed have dedicated `title` fields that can restrict results to specific roles, but the code just dumps the full keyword string (which includes industry qualifiers like "marketing agency") into the title field — causing the actor to return any role mentioning "marketing" rather than specifically "SDR" or "Sales Representative".

The root cause: the `search_query` field conflates **industry context** with **role titles**. When `"marketing agency SDR"` is passed as a job title, the actor interprets "marketing" as a role keyword, returning Marketing Specialists, Marketing Coordinators, etc.

### Issue 2: Missing mandatory fields
There is no enforcement that the pipeline must produce specific fields. Person enrichment can be dropped, and fields like `industry`, `website`, `employee_count`, `company_linkedin_url` are not validated as mandatory outputs.

## Plan

### 1. Add `role_filter` to the planner's pipeline schema (signal-planner)

Update the system prompt to include a new `role_filter` field in the stage schema for hiring_intent pipelines:

```
"role_filter": ["SDR", "Sales Representative", "Account Executive"]  // exact roles the user wants
```

This separates **what roles to search** from **what industry to search in**. The planner must populate this for hiring_intent stage 1.

Also add to the system prompt instructions:
- "When the user searches for specific roles, set `role_filter` with the EXACT role titles. The `search_query` handles industry context. `role_filter` handles the job title precision."

### 2. Use `role_filter` in actor input construction (process-signal-queue)

In `pipelineScrapeStarting()` (~line 970-1023), when `actor.category === "hiring_intent"`:
- If `stageDef.role_filter` exists, use it as the job title in the actor's title/position field
- Use the industry portion of `search_query` for the company/industry filter fields
- For Indeed: set `title` to the role filter terms (e.g., "SDR OR Sales Representative"), NOT the full search_query
- For LinkedIn Jobs: build the URL with the role filter as `keywords` parameter
- For generic job boards: use the role filter for the search/keyword field

### 3. Add mandatory output field validation to the planner (signal-planner)

Add a new section to the system prompt — **MANDATORY OUTPUT FIELDS**:

```
Every pipeline MUST produce these fields by the final stage:
1. contact_name — The person's name (must match the intended role, not a random employee)
2. industry — Company industry/vertical
3. website — Company website URL
4. company_linkedin_url — LinkedIn company page URL  
5. linkedin_profile_url — Person's LinkedIn profile URL
6. employee_count — Company size

If a stage's actors don't output a required field, you MUST add an enrichment stage that populates it. 
The pipeline is INCOMPLETE without all 6 fields.
```

### 4. Add post-plan mandatory field coverage check (signal-planner)

In `validatePipelinePlan()`, add a check that traces field production across all stages. If any mandatory field is never produced by any stage's actors, inject a warning and auto-fix by adding an appropriate enrichment stage (e.g., company_data actor for industry/employee_count, people_data for contact_name/linkedin_profile_url).

### 5. Add mandatory field validation at finalization (process-signal-queue)

In `pipelineFinalize()`, before marking the run as completed, check field coverage across all leads. If critical fields (contact_name, industry, website, company_linkedin_url, linkedin_profile_url, employee_count) have <30% coverage, log a warning and set a `field_gaps` array on the run record so the UI can display which data is missing.

### 6. Strengthen AI filter to validate role relevance (signal-planner)

Update the planner's system prompt to instruct AI filter stages to **always include job-title validation** when the pipeline searches for specific roles. The filter prompt must reject leads where the scraped job title doesn't match the user's intended roles.

### Files Modified
- `supabase/functions/signal-planner/index.ts` — Add `role_filter` schema, mandatory output field requirements, post-plan field coverage validation
- `supabase/functions/process-signal-queue/index.ts` — Use `role_filter` for actor title fields, add finalization field coverage check

