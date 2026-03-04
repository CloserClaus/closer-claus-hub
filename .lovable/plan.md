

## Root Cause

The breakpoint is at the **Apify API level** — the actor returned 0 rows. The input sent was:

```text
keyword: "SDR OR BDR OR 'Appointment Setter' OR 'Sales Representative' OR 'Business Development'"
timePosted: "past24h"
```

Two problems:

1. **LinkedIn's search does not support boolean OR syntax in the keyword field.** The actor passes the keyword as-is to LinkedIn's URL search parameter. LinkedIn treats this entire string as a literal phrase search, not a boolean query. It searches for jobs literally titled "SDR OR BDR OR..." — which returns nothing.

2. **`past24h` is very restrictive.** Even with a correct keyword, searching only the last 24 hours for a niche role in a niche industry yields few or no results on many days.

## Fix

### A. Multi-keyword execution strategy

When the AI planner generates a compound keyword like `"SDR OR BDR OR 'Sales Rep'"`, the execution engine should **split it into separate Apify calls** — one per keyword — then merge and deduplicate results.

In `handleExecuteSignal`, after building the actor input:
- Detect if `keyword` contains `OR` separators or is a comma-separated list
- Split into individual keywords (e.g., `["SDR", "BDR", "Appointment Setter", "Sales Representative"]`)
- Run each keyword as a separate Apify call (sequentially to avoid rate limits), each with `maxResults` divided by the number of keywords
- Merge all raw results, deduplicate by job URL or company+title before continuing to normalization

### B. Default `timePosted` to `pastWeek` for hiring intent

Update the AI planner system prompt to instruct: "For hiring intent queries, prefer `pastWeek` unless the user explicitly asks for today's jobs only." The `past24h` window is too narrow for most use cases.

### C. Update `buildGenericInput` with keyword splitting

Add a utility that detects boolean-style keywords and converts them to an array of individual search terms. The execution loop handles running each term.

### Changes

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Add keyword splitting logic in `handleExecuteSignal`. Update system prompt to prefer `pastWeek` for hiring queries. Merge+dedup results from multiple keyword runs. |

