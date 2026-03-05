

## Signal Scraper: Multi-Stage Pipeline Redesign

### The Core Problem

The current system is a **flat scrape-and-filter** model: it runs all actors in parallel, collects results, then does dedup + AI classification in a single pass. This means:

1. AI classification only sees company names + job posting text (no website content to verify)
2. No sequential enrichment — can't use Stage 1 output as input for Stage 2 actors
3. Results are company-level shells with no person-level data (no founder/CEO names)
4. Every query gets the same flow — the AI planner has no ability to design multi-step pipelines
5. The desired output (Name, Title, Company, Headcount, Location, LinkedIn profile URL, LinkedIn company URL, Website, Email, Phone) requires at least 3-4 sequential scraping steps that the current architecture can't express

### Target Architecture

Replace the flat plan format with a **dynamic pipeline of stages**. The AI planner designs a sequence of stages, and the processor executes them one at a time, feeding each stage's output as the next stage's input.

```text
Example: "Marketing agencies (1-10) employees hiring sales reps"

Stage 1: SCRAPE    — LinkedIn Jobs + Indeed (discover companies hiring for sales)
                     → ~2000 raw company names + websites + LinkedIn company URLs
Stage 2: AI_FILTER — "Is this COMPANY a marketing/advertising agency?" (name + domain only)
                     → ~400 candidates (removes Meta, Amazon, hospitals, etc.)
Stage 3: SCRAPE    — LinkedIn Company profiles (get headcount, industry, HQ)
                     → Enriches surviving leads with real employee counts
Stage 4: AI_FILTER — "Does this company have 1-10 employees?"
                     → ~60 qualified small agencies
Stage 5: SCRAPE    — LinkedIn People Search (title: CEO/Founder/Owner at company)
                     → Finds decision makers: name, title, LinkedIn profile URL
Stage 6: SCRAPE    — Contact Enrichment (scrape company websites for email/phone)
                     → Stores email/phone hidden until user enriches
```

Different queries produce different pipelines:
- "Chiropractors in Dallas" → Google Maps → Contact Enrichment (2 stages)
- "SaaS startups with 50+ employees" → Google Search → Website Crawler → AI Verify → LinkedIn Companies → AI Headcount → Find People → Contacts (7 stages)

### Implementation Plan

This is a large change touching the planner, processor, database, UI, and hook. I'll implement it in **3 phases** within this task.

---

#### Phase 1: Database + New Plan Format

**Database migration** — Add to `signal_runs`:
- `current_pipeline_stage` (integer, default 0) — tracks which stage the pipeline is executing
- `pipeline_stage_count` (integer, default 1) — total stages for progress display

Add to `signal_leads`:
- `pipeline_stage` (text, nullable) — which stage produced/last updated this lead
- `website_content` (text, nullable) — scraped website text for deep AI analysis
- `linkedin_profile_url` (text, nullable) — decision maker's personal LinkedIn
- `company_linkedin_url` (text, nullable) — company's LinkedIn page

**New actors** added to catalog in both edge functions:
- `website_crawler` — `apify/website-content-crawler` — scrapes company about pages for AI verification
- `linkedin_people` — `curious_coder/linkedin-people-scraper` — finds employees by title at a company

---

#### Phase 2: Planner Rewrite (`signal-planner/index.ts`)

Replace the current AI prompt that outputs a flat `[{source, search_query, ...}]` array with a new prompt that outputs a **pipeline**:

```json
{
  "signal_name": "Marketing agencies hiring sales reps",
  "pipeline": [
    {
      "stage": 1, "name": "Discover hiring companies",
      "type": "scrape", "actors": ["linkedin_jobs", "indeed_jobs"],
      "params_per_actor": { "linkedin_jobs": {...}, "indeed_jobs": {...} },
      "dedup_after": true
    },
    {
      "stage": 2, "name": "Filter to marketing agencies",
      "type": "ai_filter",
      "prompt": "Is this company a marketing/advertising/digital agency based on its name and domain?",
      "expected_pass_rate": 0.20
    },
    {
      "stage": 3, "name": "Get company details from LinkedIn",
      "type": "scrape", "actors": ["linkedin_companies"],
      "input_from": "company_linkedin_url",
      "updates_fields": ["employee_count", "industry", "website"]
    },
    {
      "stage": 4, "name": "Filter to 1-10 employees",
      "type": "ai_filter",
      "prompt": "Does this company have 1-10 employees based on employee_count?",
      "expected_pass_rate": 0.50
    },
    {
      "stage": 5, "name": "Find decision makers",
      "type": "scrape", "actors": ["linkedin_people"],
      "input_from": "company_linkedin_url",
      "search_titles": ["CEO", "Founder", "Owner", "Managing Director"],
      "updates_fields": ["contact_name", "title", "linkedin_profile_url"]
    },
    {
      "stage": 6, "name": "Get contact info",
      "type": "scrape", "actors": ["contact_enrichment"],
      "input_from": "website",
      "updates_fields": ["email", "phone"]
    }
  ]
}
```

The AI prompt will include:
- Full actor catalog with input/output schemas
- 4-5 example pipelines for different query types (hiring intent, local business, web discovery, enrichment-only)
- Rules: always end with person-finding + contact enrichment unless query is purely company-level
- The desired output schema users expect
- Instructions on when to use `ai_filter` vs `scrape` stages
- How `input_from` works (takes a field from surviving leads and passes as actor input)

**Backward compatibility**: The processor detects the format — if `signal_plan.pipeline` exists, use the new pipeline executor; otherwise fall back to the legacy flat flow so in-progress runs don't break.

**Cost estimation**: Sum across all scrape stages. Each stage estimates its input size from the previous stage's expected pass rate, then calculates credits. Show a funnel in the plan display.

---

#### Phase 3: Processor Rewrite (`process-signal-queue/index.ts`)

Replace the fixed 4-phase model (starting → scraping → collecting → finalizing) with a **stage-aware pipeline executor**.

The `processing_phase` field encodes both stage and sub-phase: `stage_1_starting`, `stage_1_scraping`, `stage_1_collecting`, `stage_2_ai_filter`, `stage_3_starting`, etc.

**Pipeline executor logic:**

```text
1. Read current_pipeline_stage from run
2. Get stage definition from signal_plan.pipeline[current_pipeline_stage]
3. If stage.type == "scrape":
   a. stage_N_starting: Build actor inputs FROM surviving leads' fields
      - For stage 1: use original query params
      - For stage 3+: read leads from DB, extract input_from field values,
        pass as actor input (e.g., company_linkedin_url → profileUrls)
   b. stage_N_scraping: Poll Apify runs
   c. stage_N_collecting: Collect results, UPDATE existing leads
      (not insert new ones — enrich the survivors)
      Exception: person-finding stages INSERT person-level sub-leads
   d. Advance to next stage
4. If stage.type == "ai_filter":
   a. Load surviving leads from DB
   b. Run AI classification using stage.prompt
   c. Delete failures
   d. Advance to next stage
5. After last stage: run workspace dedup, calculate cost, finalize
```

**Key design decisions:**
- Scrape stages after stage 1 take input FROM existing leads (e.g., company_linkedin_url values become `profileUrls` for the linkedin_companies actor)
- AI filter stages operate on the current lead set, deleting non-matches
- Person-finding stages (stage 5) create person-level records linked to the company lead — or update the existing lead with contact_name/title/linkedin_profile_url
- Each stage can span multiple cron cycles (scraping takes time)
- The cron worker picks up where it left off using `current_pipeline_stage` + `processing_phase`

**Batch sizes for enrichment stages:**
- Website crawler: batch 50 URLs per actor run
- LinkedIn companies: batch 100 URLs per run
- LinkedIn people: batch 50 company URLs per run
- Contact enrichment: batch 50 websites per run

---

#### UI Updates (`SignalScraperTab.tsx` + `useSignalScraper.ts`)

**Plan display**: Show the pipeline as a visual funnel with stage names and estimated counts at each stage.

**Progress display**: When a pipeline run is active, show:
- "Stage 3/6: Get company details from LinkedIn... 45/80 done"
- A funnel: "2000 → 400 → 80 → 60 → 25 leads"

**Hook updates**: Add `current_pipeline_stage`, `pipeline_stage_count`, `linkedin_profile_url`, `company_linkedin_url` to the interfaces.

**Results table**: Already has the right columns — just needs `linkedin_profile_url` and `company_linkedin_url` added as link icons.

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add columns to `signal_runs` and `signal_leads` |
| `supabase/functions/signal-planner/index.ts` | New pipeline AI prompt; new actors in catalog; pipeline cost estimation; backward-compatible plan format |
| `supabase/functions/process-signal-queue/index.ts` | Pipeline executor with stage-aware processing; new actors; enrichment stage logic; legacy fallback |
| `src/hooks/useSignalScraper.ts` | New fields on `SignalRun` and `SignalLead` interfaces |
| `src/components/leads/SignalScraperTab.tsx` | Pipeline progress UI; funnel visualization in plan display; LinkedIn profile link in results table |

### Implementation Order

1. Database migration (new columns)
2. Add new actors to catalog in both edge functions
3. Rewrite planner prompt to generate pipeline format + cost estimation
4. Rewrite processor with pipeline executor (keeping legacy fallback)
5. Update hook interfaces and UI for pipeline progress

### Risk Mitigation

- **Backward compatibility**: Legacy flat plans still work — the processor checks for `pipeline` key
- **Partial failures**: If any stage's actors fail, the pipeline can retry from that stage
- **Cost control**: Enrichment stages only run on the filtered set (post-AI), keeping Apify costs proportional to actual quality leads
- **Cron timeout**: Each stage's sub-phases are designed to complete within the edge function timeout (~60s), with state persisted between cron cycles

