

## Root Cause: Overly Strict Static Filters

The pipeline trace tells the full story:

```text
cross_keyword_dedup:  4 → 1   (expected — same company across keywords)
static_filter:        1 → 0   ← the only lead was killed here
```

The problem is on **line 770** of `process-signal-queue/index.ts`:

```typescript
if (val === undefined || val === null) return false;
```

When the AI planner generates filters (e.g., `{field: "employee_count", operator: ">", value: "10"}`), and the scraped lead doesn't have that field at all (which is common — Apify actors return inconsistent schemas), the lead is **automatically rejected**. A missing field counts as a filter failure, not a pass.

With only 1 lead surviving dedup, a single missing field on that lead wipes the entire result set to zero.

Additionally, 5 out of 8 LinkedIn runs returned 0 rows and 2 FAILED entirely, suggesting the LinkedIn actor input params or proxy config may need tuning — but that's secondary. The immediate fix is the filter behavior.

### Fix

**`supabase/functions/process-signal-queue/index.ts` (~line 770)**

Change the null/undefined handling: if the lead doesn't have the field the filter checks, **skip that filter** (treat as pass) rather than rejecting the lead. Missing data should not be penalized — it just means we don't have enough info to filter on that dimension.

```typescript
// Before:
if (val === undefined || val === null) return false;

// After:
if (val === undefined || val === null) return true; // missing data = pass filter
```

This is the only change needed. One line.

### Why This Is Safe

- The AI classification step (lines 784+) runs after static filters and handles nuanced relevance checking with full context
- Static filters are meant for hard numeric/text cutoffs on fields that exist — not for rejecting leads with incomplete data
- The planner can still generate useful filters (e.g., location contains "US") but they'll only apply when the data is present

### Files

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Line 770: change `return false` to `return true` for null/undefined filter values |

