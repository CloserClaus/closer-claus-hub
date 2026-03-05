

## Signal Scraper: Comprehensive Fix Plan

### Problems Identified

1. **AI classification is not filtering properly** — The run shows 423 leads but "View Leads" displays 1000. The AI classifier receives only `company_name`, `description`, `website`, `location`, and `employee_count` but the `description` field for job board leads contains job descriptions (e.g., "We're looking for a Sales Rep to..."), NOT company descriptions. So the AI sees "Meta is hiring a Sales Rep" and thinks "Meta is a marketing agency" because the description mentions marketing keywords. The classifier needs the raw job title and company info to make correct decisions.

2. **Leads have no useful data** — Signal leads only store: `company_name`, `website`, `domain`, `phone`, `email`, `linkedin`, `location`. No founder name, no title, no industry, no employee count. The `extra_data` JSON blob has raw scrape data but it's never surfaced. There's no post-filtering enrichment step to look up the actual company owner/founder.

3. **CRM import is broken** — The `addToCRM` function maps: `first_name: ''`, `last_name: ''`, `company: lead.company_name`, `notes: "Website: ...\nLocation: ..."`. This produces gibberish because the CRM expects person-level data (name, title) but signal leads are company-level. No proper field mapping exists.

4. **Lead results UI is a card grid** — Currently uses a 3-column card layout. User wants a table like the Apollo search results tab (Name, Title, Company, Location, Links, Contact).

5. **Estimates are unrealistic** — The formula `keywordCount * Math.max(50, Math.ceil(maxPerKeyword / keywordCount))` divides max by keyword count, deflating estimates. Plus the 30%/60% filter rate assumptions are arbitrary.

6. **leads_discovered count mismatch** — Shows 423 in history but 1000 when viewing. The `leads_discovered` is set from `uniqueLeads.length` after workspace dedup, but the query fetching leads for display has no filter — it fetches ALL leads for the run_id including ones that should have been deleted.

---

### Phase 1: Fix AI Classification Quality

**File: `supabase/functions/process-signal-queue/index.ts`** (lines 1028-1068)

The AI classifier prompt is too vague. It sends `name`, `description`, `website`, `location`, `employee_count` — but `description` is the job posting text, not a company description.

Fix: Send more discriminating data to the classifier:
- Include `title` (the job title — "Sales Representative at Meta" helps reject Meta as non-agency)
- Include `industry` from extra_data
- Include `employee_count` from extra_data
- Rewrite the prompt to be explicit: "Determine if the COMPANY (not the job) matches the criteria. The description is a job posting, not a company description. Focus on the company name, industry, and employee count."

Also fix the `extra_data` access — currently tries `item.extra_data?.employee_count` but extra_data stores the raw Apify output with fields like `companyEmployeesCount`, not `employee_count`.

### Phase 2: Add Founder/Contact Enrichment Step

**File: `supabase/functions/process-signal-queue/index.ts`**

After AI classification and workspace dedup, add a new enrichment phase that runs the `contact_enrichment` actor (already in the catalog, key: `contact_enrichment`, actor ID: `9Sk4JJhEma9vBKqrg`) on the surviving leads' websites. This scrapes each company's website for:
- Contact names, titles, emails, phones, LinkedIn URLs

Store the enriched data back into `signal_leads` fields and `extra_data`.

This is expensive per-lead, so only run it on the final filtered set (post AI-classification, post-dedup). Batch websites into groups of 50 for the actor.

**Database: `signal_leads` table** — Add columns:
- `contact_name` (text, nullable) — founder/owner name
- `title` (text, nullable) — their title
- `industry` (text, nullable)
- `employee_count` (text, nullable)
- `city` (text, nullable)
- `state` (text, nullable)  
- `country` (text, nullable)

### Phase 3: Fix CRM Import Mapping

**File: `src/components/leads/SignalScraperTab.tsx`** (lines 490-537)

Update `addToCRM` and `addAllToCRM` to properly map signal lead fields to CRM lead fields:

```typescript
{
  workspace_id: workspaceId,
  created_by: userId,
  first_name: lead.contact_name?.split(' ')[0] || '',
  last_name: lead.contact_name?.split(' ').slice(1).join(' ') || '',
  company: lead.company_name || '',
  company_domain: lead.domain || '',
  title: lead.title || '',
  phone: lead.enriched ? lead.phone : null,
  email: lead.enriched ? lead.email : null,
  linkedin_url: lead.linkedin || '',
  city: lead.city || '',
  state: lead.state || '',
  country: lead.country || '',
  industry: lead.industry || '',
  employee_count: lead.employee_count || '',
  source: `Signal: ${lead.source}`,
}
```

No more dumping website/location into `notes`.

### Phase 4: Redesign Lead Results as Table

**File: `src/components/leads/SignalScraperTab.tsx`** (lines 604-706)

Replace the card grid (`SignalResultsView`) with a proper table matching the Apollo search tab style:

| Select | Name | Title | Company | Location | Links | Contact | Actions |
|--------|------|-------|---------|----------|-------|---------|---------|
| ☐ | John Smith | CEO | Acme Marketing | Dallas, TX | 🔗 🌐 | 📧 📞 (hidden until enriched) | Add to CRM / Enrich |

- Checkbox column for bulk select
- Name + Title columns from enriched data  
- Company column with domain
- Location column
- Links column with LinkedIn and website icons
- Contact column (hidden until enriched, shows "Reveal" button)
- Actions column (Add to CRM, Enrich, Start Outreach)
- Bulk actions bar: "Add All to CRM", "Enrich Selected"

Update `SignalLead` interface in `useSignalScraper.ts` to include the new fields.

### Phase 5: Fix Estimates

**File: `supabase/functions/signal-planner/index.ts`** (lines 562-592)

Current formula: `keywordCount * Math.max(50, Math.ceil(maxPerKeyword / keywordCount))` — this divides by keyword count, underestimating.

Fix to: `keywordCount * maxPerKeyword` (each keyword gets the full max). Then apply realistic filter rates:
- With AI classification: 5-15% pass rate (not 30%) — most raw scrapes are irrelevant
- Without AI: 40% pass rate (not 60%)
- Workspace dedup: subtract 10% for returning users

Also add `estimated_after_ai` and `estimated_after_dedup` to show the user a funnel, not just one number.

### Phase 6: Fix leads_discovered vs displayed count mismatch

**File: `supabase/functions/process-signal-queue/index.ts`**

The finalizing phase deletes rejected leads from `signal_leads` table. But the deletion might fail silently or the count might not reflect reality. Add a final count query after all deletions:

```sql
SELECT count(*) FROM signal_leads WHERE run_id = $1
```

Use this as the authoritative `leads_discovered` count.

**File: `src/hooks/useSignalScraper.ts`** — The leads query has no `.limit()`, so Supabase defaults to 1000. Add `.limit(10000)` to the signal leads fetch.

---

### Summary of Changes

| File | Changes |
|------|---------|
| `supabase/functions/process-signal-queue/index.ts` | Fix AI classifier prompt + data sent; add post-filter contact enrichment phase; fix leads_discovered count |
| `supabase/functions/signal-planner/index.ts` | Fix estimate formula; add funnel-style estimates |
| `src/components/leads/SignalScraperTab.tsx` | Replace card grid with table view; fix CRM import mapping; add bulk actions |
| `src/hooks/useSignalScraper.ts` | Add new fields to SignalLead; add .limit(10000) to leads query |
| Database migration | Add columns to `signal_leads`: `contact_name`, `title`, `industry`, `employee_count`, `city`, `state`, `country` |

### Implementation Order

1. Database migration (new columns)
2. Fix AI classifier (Phase 1) — most critical, stops bad leads
3. Add enrichment step (Phase 2) — provides the data users need
4. Fix CRM mapping (Phase 3) — proper field mapping
5. Redesign results table (Phase 4) — better UI
6. Fix estimates (Phase 5) — realistic numbers
7. Fix count mismatch (Phase 6) — consistency

