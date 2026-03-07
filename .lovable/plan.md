

## Plan: Fix Signal Scraper Quality, Filtering, and Reveal Issues

### Root Cause Analysis

After reviewing the full pipeline code, here are the identified issues:

**Issue 1: Poor AI filtering quality (wrong companies, wrong sizes)**
- The AI filter stages use `google/gemini-2.5-flash-lite` — the weakest, cheapest model. It's not capable enough for nuanced classification like "is this a marketing agency?" with minimal data.
- The AI filter only receives `company_name`, `website`, `industry`, `employee_count` — but from job boards, `industry` is often empty or generic (e.g., "Staffing and Recruiting"). The filter has too little context to make good decisions.
- The `employee_count` field from job boards is often missing or inaccurate. The pipeline relies on Stage 3 (LinkedIn Companies enrichment) to get accurate headcount, but that only works if `company_linkedin_url` was captured in Stage 1 — which it often isn't.

**Issue 2: 0 names returned**
- The `linkedin_people` stage (Stage 5) constructs search URLs using `encodeURIComponent(titles) + encodeURIComponent(companyName)`. After scraping, it tries to match results back to existing leads using `ilike` on the first 30 chars of company name. This matching is fragile — LinkedIn company names often differ from job board company names (e.g., "Acme Inc" vs "Acme Marketing Group").
- If matching fails, the lead keeps its original empty `contact_name`.

**Issue 3: "Enrich" vs "Reveal" inconsistency**
- The UI shows "Reveal" when `enriched=false` but `email/phone` exists (from pipeline contact_enrichment). Shows "Enrich" when `enriched=false` AND no email/phone. This distinction confuses users — they should all say "Reveal" since the action is the same (attempt to get contact info).

**Issue 4: Reveal doesn't show data after clicking**
- The `enrichLeadMutation` correctly sets `enriched=true` and invalidates the query. But the mutation's condition for the "free reveal" path (line 728: `if (lead.email || lead.phone)`) updates the DB then returns — but `useMutation` uses the stale `lead` object from the closure. The query invalidation should refetch, but there may be a race condition where the toast fires before the refetch completes, making it seem like nothing happened.
- More critically: when the lead has NO existing email/phone, the mutation calls `apollo-enrich` which is an async enrichment — the data isn't available immediately. The user sees "contact info revealed" but the enrichment hasn't completed yet.

**Issue 5: Credits not deducted on reveal**
- By design, "Reveal" (when data already exists from pipeline) is free — the cost was already paid during the pipeline run. But "Enrich" via Apollo fallback should deduct 5 credits. The `apollo-enrich` function handles credit deduction, but the success toast says "Contact info revealed" which is misleading when Apollo enrichment is async.

**Issue 6: Industry not presented well**
- Raw industry strings from job boards/LinkedIn are displayed as-is (e.g., "IT Services and IT Consulting" or comma-separated lists).

---

### Fixes

#### Fix 1: Upgrade AI filter model and improve prompts
**File**: `supabase/functions/process-signal-queue/index.ts` (line ~904)
- Change AI filter model from `google/gemini-2.5-flash-lite` to `google/gemini-2.5-flash` — much better at classification with minimal cost increase.
- Add `description` (job posting title/description) and `domain` to the data sent to the AI filter so it has more context to judge company type.
- Make the system prompt more explicit: instruct the AI to check domain names for clues (e.g., "seoagency.com" → marketing), and to reject when industry/company data is ambiguous.

#### Fix 2: Improve linkedin_people matching logic
**File**: `supabase/functions/process-signal-queue/index.ts` (lines 811-833)
- Match by `domain` instead of company name substring. When a person result includes `currentCompany`, also try matching by normalised company name (exact case-insensitive match, not `ilike` with truncation).
- Fall back to matching by company LinkedIn URL if available.

#### Fix 3: Unify "Reveal" button — remove "Enrich" distinction
**File**: `src/components/leads/SignalScraperTab.tsx` (lines 918-935)
- Change the UI so both cases show "Reveal" button. The underlying logic stays the same (free if data exists, Apollo fallback if not), but the label is consistent.
- Update the success toast to differentiate: "Contact info revealed" vs "Enrichment started — check back shortly."

#### Fix 4: Fix reveal showing data after click
**File**: `src/components/leads/SignalScraperTab.tsx` (enrichLeadMutation)
- After setting `enriched=true`, await the query invalidation before showing the toast.
- For the Apollo fallback path, show a different toast: "Enrichment queued — data will appear shortly" instead of implying it's already done.
- After Apollo enrichment returns, update `signal_leads` with any returned email/phone data so it actually shows in the table.

#### Fix 5: Improve industry display
**File**: `src/components/leads/SignalScraperTab.tsx` (line ~897)
- Truncate long industry strings and clean up common patterns (remove "and" conjunctions, take first category if comma-separated).
- Show as a small badge instead of plain text.

#### Fix 6: Pass more context to AI filters
**File**: `supabase/functions/process-signal-queue/index.ts` (line ~920-929)
- Always include `description`, `title`, and `domain` in the data sent to the AI filter, in addition to whatever `input_fields` the stage specifies. This gives the AI much more signal for classification.

### Files to modify
- `supabase/functions/process-signal-queue/index.ts` — AI model upgrade, better matching logic, richer filter context
- `src/components/leads/SignalScraperTab.tsx` — Unified "Reveal" button, better toast messages, industry display cleanup

