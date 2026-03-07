## Plan: Advanced Settings for Signal Scraper + CSV Export for Leads

### 1. Collapsible Advanced Settings in Signal Scraper

**Location**: Inside `SignalScraperTab.tsx`, below the query textarea and above the "Generate Pipeline" button.

**Settings to include**:

- **Max results per source** (slider/input, default 2500, range 100-5000): Controls how many events are scraped in stage 1. Directly affects cost. Labeled clearly with cost impact (e.g., "~$X estimated scrape cost").
- **Date range** (dropdown: Past 24h, Past week, Past 2 weeks, Past month): Controls recency of job postings / listings.
- **AI filtering strictness** (Low / Medium / High): Controls expected pass rates in AI filter stages — "High" means more aggressive filtering, fewer but higher-quality leads.
    
  **How it works**:

- These settings are passed as `advanced_settings` in the `generatePlan` mutation body to `signal-planner`.
- In `signal-planner/index.ts`, the `handleGeneratePlan` function reads `advanced_settings` and:
  - Injects a `max_results_per_source` instruction into the AI system prompt so the AI respects the user's limit.
  - After the AI returns the plan, **caps** stage 1 actor params (count, limit, maxCrawledPlacesPerSearch, maxItems) to the user's max.
  - Adjusts date params if user changed the date range.
  - &nbsp;
- The `estimatePipelineCost` function already uses actual params, so cost estimates will automatically reflect the capped values.

**UI**: Uses `Collapsible` component with a "⚙️ Advanced Settings" trigger, styled consistently with existing cards.

### 2. CSV Export for All Lead Sections

**Approach**: Create a shared `exportLeadsToCSV` utility function in `src/lib/csvExport.ts`.

**Function signature**: `exportLeadsToCSV(leads: Array<Record<string, any>>, filename: string)`

- Maps lead objects to flat CSV rows with columns: Name, Title, Company, Email, Phone, LinkedIn, Website, Location, Industry, Employee Count, Status.
- Creates a Blob, triggers download via temporary anchor element.

**Integration points** — add an "Export CSV" button to:

1. **ApolloSearchResults** (search results) — exports current page or all selected leads.
2. **SignalScraperTab** (signal results view) — exports discovered signal leads.
3. **SavedLeadsTab** — exports filtered saved leads.
4. **LeadListsTab** (list detail view) — exports leads in the viewed list.

Each button uses the `Download` icon from lucide-react, placed in the existing action bars.

### Technical Details

**Files to modify**:

- `src/components/leads/SignalScraperTab.tsx` — Add collapsible advanced settings UI, pass settings to `generatePlan`.
- `src/hooks/useSignalScraper.ts` — Update `generatePlanMutation` to accept and forward `advanced_settings`.
- `supabase/functions/signal-planner/index.ts` — Read `advanced_settings`, inject into prompt, cap actor params post-AI.
- `src/components/leads/ApolloSearchResults.tsx` — Add CSV export button.
- `src/components/leads/SavedLeadsTab.tsx` — Add CSV export button.
- `src/components/leads/LeadListsTab.tsx` — Add CSV export button.

**Files to create**:

- `src/lib/csvExport.ts` — Shared CSV export utility.