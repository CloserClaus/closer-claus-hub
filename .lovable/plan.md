

# Fix: Missing `estimation.source_label` Crash

## Root Cause

The backend response from `signal-planner` (line 1567-1581) returns flat fields:
```json
{ "run_id": "...", "plan": {...}, "estimated_rows": 500, "estimated_leads": 50, ... }
```

But the frontend expects a nested `estimation` object with a `source_label` field:
- `src/hooks/useSignalScraper.ts:164` — `data.estimation.source_label` crashes because `data.estimation` is `undefined`
- `src/components/leads/SignalScraperTab.tsx:451` — `estimation.source_label` rendered in a Badge

The `source_label` field was never added to the backend response when the pipeline format was introduced. The frontend interface `SignalEstimation` declares it, but nothing populates it.

## Two Issues to Fix

### 1. Backend: Add `estimation` wrapper with `source_label` to the response

In `supabase/functions/signal-planner/index.ts` (line 1567-1581), wrap the cost/estimation fields in an `estimation` object and derive `source_label` from the first scrape stage's category (e.g., `"hiring_intent:linkedin"` → `"LinkedIn Jobs"`):

```typescript
return new Response(JSON.stringify({
  run_id: insertData.id,
  plan: parsedPlan,
  warnings: warnings.length > 0 ? warnings : undefined,
  estimation: {
    estimated_rows: costEstimate.totalEstimatedRows,
    estimated_leads: costEstimate.totalEstimatedLeads,
    credits_to_charge: costEstimate.totalCredits,
    cost_per_lead: costEstimate.totalEstimatedLeads > 0
      ? (costEstimate.totalCredits / costEstimate.totalEstimatedLeads).toFixed(2)
      : "N/A",
    source_label: deriveSourceLabel(parsedPlan.pipeline),
    stage_funnel: costEstimate.stageFunnel,
    yield_rate: costEstimate.yieldRate,
    yield_label: costEstimate.yieldLabel,
    yield_guidance: costEstimate.yieldGuidance,
  },
}), ...);
```

Add a helper `deriveSourceLabel()` that finds the first scrape stage and looks up its category in `STAGE_CATEGORIES` to get the `.label` (e.g., "LinkedIn Jobs Scraper"). Fallback to the stage name or "Signal Search".

### 2. Frontend: Add defensive fallback for `estimation`

In `src/hooks/useSignalScraper.ts` line 164, guard against missing estimation:
```typescript
toast({ title: 'Signal Plan Generated', description: `Source: ${data.estimation?.source_label || 'Signal Search'}` });
```

In `src/components/leads/SignalScraperTab.tsx` line 451, guard similarly:
```tsx
<Badge variant="outline">{estimation?.source_label || 'Signal'}</Badge>
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Wrap response in `estimation` object, add `deriveSourceLabel()` helper, add `source_label` and `cost_per_lead` |
| `src/hooks/useSignalScraper.ts` | Defensive `?.` on `data.estimation` in toast |
| `src/components/leads/SignalScraperTab.tsx` | Defensive `?.` fallback on `estimation.source_label` |

