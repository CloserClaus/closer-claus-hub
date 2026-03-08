

# Fix Signal Scraper: Missing Names, Wrong Roles, Company LinkedIn

## Root Cause Analysis

The biopsy of run `0dffb0c9-9f4a-40a9-bae4-4a518d084878` reveals three distinct issues:

### Issue 1: No contact names
The pipeline planned 3 stages: (1) Job board scraping, (2) AI filter, (3) "Identify Decision Makers" via `linkedin_people` actor. However, quality validation rated Stage 1 as LOW, triggering pipeline reconfiguration that **dropped Stage 3 entirely** (reduced from 3 stages to 2). So leads were finalized without ever running the person-enrichment stage. All `contact_name` and `linkedin_profile_url` fields are NULL.

### Issue 2: Wrong job roles returned
The search query was `"Marketing Sales Representative OR Account Executive"` but LinkedIn/Indeed returned generic marketing roles ("Entry Level Marketing", "Marketing Specialist", "Influencer Marketing Coordinator", "Paid Social Specialist") — not sales roles at marketing agencies. The AI filter (Stage 2) was supposed to clean this up but its prompt only checks whether it's a marketing agency vs. sales-as-a-service firm — it does **not** filter by job title relevance.

### Issue 3: LinkedIn links point to company pages
The `linkedin` field is populated from job board scraper output, which maps to `companyLinkedinUrl` (e.g., `linkedin.com/company/rynoss`). Since Stage 3 never ran, `linkedin_profile_url` (person-level) was never populated. The UI falls back to the `linkedin` field, which is the company page.

## Plan

### 1. Make Stage 3 (person enrichment) resilient to pipeline reconfiguration

**File: `supabase/functions/process-signal-queue/index.ts`**

In the pipeline reconfiguration logic (~line 530-575), update the system prompt to instruct the repair agent that "Identify Decision Makers" or person-enrichment stages must **never be dropped** — they should be kept or replaced with an alternative (e.g., `code_crafter_leads_finder` which only needs `company_name`). Add a post-reconfiguration validation: if the original pipeline had a person-enrichment stage and the reconfigured one doesn't, re-inject it.

### 2. Add job-title relevance to the AI filter prompt in the signal planner

**File: `supabase/functions/signal-planner/index.ts`**

When the planner generates AI filter stages, enhance the system prompt to instruct it to **always include job-title relevance filtering** when the user's query specifies specific roles. The filter prompt should reject leads where the scraped job title doesn't match the user's intent (e.g., reject "Marketing Specialist" when looking for "Sales Representative" roles).

### 3. Ensure the UI distinguishes company vs. person LinkedIn

**File: `src/components/leads/SignalScraperTab.tsx`**

The UI already does `lead.linkedin_profile_url || lead.linkedin` for the LinkedIn column. When `linkedin_profile_url` is null, it shows the company LinkedIn with a person icon — misleading. Add a visual distinction: show a building/company icon when falling back to `lead.linkedin`, and only show person icon when `linkedin_profile_url` exists. Also label it "Company" vs. "Profile".

### 4. Update the "Businesses Hiring for Marketing Roles" template

**Database update to `signal_templates`**

Update the template's `plan_override` to include a hint that the AI filter stage must also validate job-title relevance (only keep roles matching marketing manager/coordinator/CMO, exclude generic "entry level marketing" or unrelated titles).

### Files Modified
- `supabase/functions/process-signal-queue/index.ts` — protect person-enrichment stage from being dropped during reconfiguration
- `supabase/functions/signal-planner/index.ts` — add job-title relevance to AI filter prompt generation
- `src/components/leads/SignalScraperTab.tsx` — distinguish company vs. person LinkedIn in UI
- Database `signal_templates` — update plan_override for hiring template

