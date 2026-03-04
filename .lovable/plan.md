

## Root Cause Analysis

There are **three compounding bugs** causing zero results:

### Bug 1: Keyword splitting reads from the wrong field
The code at line 650:
```typescript
const rawKeyword = plan.search_params?.[keywordField!] || plan.search_query || "";
```
The AI planner follows our instructions correctly — puts `"SDR"` in `search_params.keyword` and `"SDR OR BDR OR Appointment Setter OR Sales Representative"` in `search_query`. But the code prefers `search_params.keyword` ("SDR"), so the compound keywords in `search_query` are never split. Result: only 1 keyword runs instead of 4-5.

### Bug 2: Single keyword "SDR" + past24h = too narrow
LinkedIn's `past24h` window with a single generic keyword "SDR" in all of the United States returns very few or zero public listings, especially since this actor scrapes public pages without login.

### Bug 3: The AI planner prompt says "put ONLY the most important one in keyword"
This instruction actively sabotages the multi-keyword split system. The AI correctly follows the prompt and puts one keyword in `search_params.keyword`, but then the split function never sees the variations.

## Fix Plan

### Change 1: Always prefer `search_query` for splitting
Reverse the priority in `handleExecuteSignal` — read from `plan.search_query` first (which contains the OR-separated variations), and only fall back to `search_params.keyword` if `search_query` has no OR separators.

### Change 2: Update the AI planner prompt
Remove the instruction to put "only the most important keyword" in `search_params.keyword`. Instead tell the AI:
- Put ALL keyword variations in `search_query` separated by OR
- Put the FIRST/primary keyword in `search_params.keyword` (this is used as fallback only)
- The engine will automatically split `search_query` on OR and run each keyword separately

### Change 3: Add proxy configuration
The LinkedIn actor documentation recommends residential proxies. Add `proxyConfiguration: { useApifyProxy: true }` to the actor input for LinkedIn actors to improve success rates.

### Change 4: Increase default maxResults for LinkedIn
The actor defaults to 25. Our catalog says `default: 100, max: 500` which is fine, but confirm the AI is actually sending a reasonable number. With multi-keyword split dividing by keyword count, each keyword could end up with only 20 results — set a minimum of 50 per keyword.

### Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Fix keyword source priority (lines 648-651), update AI prompt (lines 388-392), add proxy config, enforce per-keyword minimum maxResults |

No database changes needed.

