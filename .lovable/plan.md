

## Signal Scraper Comprehensive Fix Plan

### Problems Identified

1. **LinkedIn actor is "Under maintenance"** — `openclaw/linkedin-jobs-scraper` has only 23 users and is flagged "Under maintenance" on Apify. Should switch to `curious_coder/linkedin-jobs-scraper` (19K users, 4.9 rating, updated 3 days ago, identical output schema).

2. **Indeed output has nested structure, normalizer only does flat lookups** — Indeed returns `employer.name`, `location.city`, `description.text` etc. Our `normaliseGenericResults` does `item[path]` which only works for flat fields. This means company_name, location, description are all `null` even when the scrape succeeds.

3. **Max limits too small (500)** — With aggressive downstream filtering (dedup, AI classification, static filters), 500 raw results produces near-zero final leads for niche queries. LinkedIn also caps at ~1000 per search but has a "split by location" feature.

4. **No user-facing warnings for problematic queries** — Users get no feedback during plan generation about search quality risks (too broad, too narrow, unscrappable data types).

5. **No actor validation** — We've never verified our actors produce real results with human-like inputs.

---

### Phase 1: Fix the Normalizer (Critical Bug)

**File**: `supabase/functions/process-signal-queue/index.ts`

Add dot-path traversal to `normaliseGenericResults` so nested Indeed output like `employer.name` resolves correctly.

Update `outputFields` for `indeed_jobs` to include nested paths: `employer.name`, `employer.corporateWebsite`, `location.city`, `location.countryName`, `description.text`, `description.html`, `employer.industry`, `employer.employeesCount`, `baseSalary`.

---

### Phase 2: Switch LinkedIn Actor

**Files**: Both `process-signal-queue/index.ts` and `signal-planner/index.ts`

Replace `openclaw/linkedin-jobs-scraper` with `curious_coder/linkedin-jobs-scraper` (actor ID: `hKByXkMQaC5Qt9UMN`).

Input schema stays the same (uses `startUrls` or keyword-based search, `maxItems`, `scrapeCompany`, `scrapeJobDetails`). Output schema is identical (flat: `companyName`, `companyWebsite`, `companyEmployeesCount`, etc.).

Enable `splitSearchByLocation` and `targetCountry` fields in the catalog to overcome LinkedIn's 1000-result cap.

---

### Phase 3: Increase Max Limits + Pagination Strategy

**Files**: `process-signal-queue/index.ts`, `signal-planner/index.ts`

| Actor | Current Max | New Max |
|-------|------------|---------|
| linkedin_jobs | 500 | 2500 (with location splitting) |
| indeed_jobs | 500 (actor caps at 1000) | 1000 |
| google_maps | 500 | 2000 |
| yelp | 500 | 1000 |
| yellow_pages | 500 | 1000 |
| google_search | 3 pages × 10 | 10 pages × 10 |

For LinkedIn specifically, enable `splitSearchByLocation: true` + `targetCountry: "US"` to break through the 1000-result LinkedIn cap. The actor handles dedup internally.

Update AI planner system prompt to instruct higher defaults and explain that downstream filtering is aggressive.

Update credit estimation formula to account for larger scrapes.

---

### Phase 4: Plan-Time Warnings & Validation

**File**: `supabase/functions/signal-planner/index.ts`

After AI generates the plan, run validation checks before returning to the user:

| Warning | Condition | Message |
|---------|-----------|---------|
| Too narrow | Estimated leads after filter < 5 | "This search is very specific. Consider broadening your criteria to find more leads." |
| Too broad | No AI classification and no filters | "This search has no filtering. Results may include many irrelevant leads. Consider adding specific criteria." |
| Low intent signal | Source is google_maps/yelp but query mentions hiring | "Job board sources (LinkedIn/Indeed) are better for hiring intent. Adjusting sources." (auto-correct) |
| Unscrappable | Query asks for data not available from any actor (e.g., "companies that just raised funding") | "This type of data isn't available through our current sources. Try rephrasing to target observable signals like job postings or business listings." |

Return a `warnings` array alongside `plan` and `estimation` in the API response.

**File**: `src/components/leads/SignalScraperTab.tsx`

Display warnings as amber alert boxes between the plan card header and the stats grid. Each warning shows an icon + message + optional recommendation.

**File**: `src/hooks/useSignalScraper.ts`

Update the `currentPlan` type to include `warnings?: string[]`.

---

### Phase 5: Actor Smoke Test (One-Time Verification)

Create a temporary edge function `test-actors` that runs each actor with a minimal input (maxItems=5) and logs:
- Did it start successfully?
- Did it return results?
- Do the output fields match our catalog?

Actors to test:
- `curious_coder/linkedin-jobs-scraper` (new) — query: "sales representative"
- `valig/indeed-jobs-scraper` — query: "sales representative"  
- `nwua9Gu5YrADL7ZDj` (Google Maps) — query: "marketing agency"
- `yin5oHQaJGRfmJhlN` (Yelp) — query: "marketing agency"
- `trudax/yellow-pages-us-scraper` — query: "marketing agency", location: "New York, NY"

Run with `maxItems=5` / `limit=5` to avoid burning credits. Log actual output field names vs catalog expected fields. This verifies end-to-end before deploying.

After verification, delete the test function.

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `supabase/functions/process-signal-queue/index.ts` | Fix normalizer for nested output, switch LinkedIn actor, update max defaults, update Indeed output mappings |
| `supabase/functions/signal-planner/index.ts` | Switch LinkedIn actor, update max defaults, add plan-time warnings, update AI prompt for higher limits |
| `src/components/leads/SignalScraperTab.tsx` | Display warnings from plan response |
| `src/hooks/useSignalScraper.ts` | Add `warnings` to plan type |
| `supabase/functions/test-actors/index.ts` | Temporary smoke test function (create, run, delete) |

### Expected Outcome

- LinkedIn scraping uses a battle-tested actor with 19K users
- Indeed results actually normalize correctly (nested fields resolved)
- Max limits 2-5x higher so niche filtering doesn't produce zero results
- Users see clear warnings before executing problematic queries
- All actors verified to produce real results with human-like inputs

