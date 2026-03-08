

# Pagination for Signal History & Signal Leads

## Problem
Both the "My Signals" history list and the Signal Results leads table load all records without pagination — up to 10,000 leads in a single query, causing slow loads and heavy server/client burden.

## Changes

### 1. Signal Results View — Server-side pagination (25 per page)

**In `SignalResultsView` (SignalScraperTab.tsx lines 646-1008):**

- Add `currentPage` state, default 1, page size 25
- Replace the single query with a **count query** + **paginated data query** using `.range((page-1)*25, page*25-1)`
- Header shows "Signal Results — X total leads" using the count
- Table renders only the current page's 25 leads
- Add `CRMPagination` component below the table

**Bulk actions edge cases:**
- **"Select all" checkbox** toggles only the visible page's leads
- Add a **"Select all X leads across all pages"** banner (like Gmail) that appears when all on-page items are checked — sets a `selectAllAcrossPages` flag
- **"Add to CRM"** and **"Add to List"** buttons: when `selectAllAcrossPages` is true, query all leads server-side (keeping existing `.limit(10000)` logic) rather than using `selectedIds`
- **CSV Export**: always exports all leads (queries all from DB), not just current page — show a brief loading state
- **`notInCrmCount`**: when `selectAllAcrossPages`, use total count from a filtered count query instead of iterating local array
- Reset `selectedIds` and `selectAllAcrossPages` on page change

### 2. My Signals History — Client-side pagination (25 per page)

**In `SignalScraperTab` (lines 273-323):**

- Add `historyPage` state
- Slice `signalHistory` array: `signalHistory.slice((page-1)*25, page*25)`
- Add `CRMPagination` below the table
- Badge shows total count, not sliced count

This can stay client-side since signal_runs count per workspace is typically manageable (dozens to low hundreds).

### 3. Hook changes (`useSignalScraper.ts`)

- No changes needed for history (stays as-is, client-side pagination)
- The `useSignalLeads` function and the inline query in `SignalResultsView` both need updating to accept page params and return `{ data, count }`

### Files Modified
- `src/components/leads/SignalScraperTab.tsx` — pagination state, paginated query, select-all-across-pages banner, CRMPagination usage
- `src/components/crm/Pagination.tsx` — reused as-is (already exists)

