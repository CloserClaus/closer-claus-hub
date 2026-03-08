

# Fix: Persist Advanced Settings Through the Pipeline

## Problem
Advanced settings (max results per source, date range, AI strictness) are used during plan generation to shape the AI prompt and cap actor params, but they are **never saved** to the database. The `signal_runs` table lacks an `advanced_settings` column, so `process-signal-queue` always falls back to defaults.

## Fix

### 1. Add `advanced_settings` column to `signal_runs`
Create a database migration:
```sql
ALTER TABLE public.signal_runs 
ADD COLUMN IF NOT EXISTS advanced_settings jsonb DEFAULT '{}';
```

### 2. Update the INSERT in `signal-planner/index.ts`
Re-add `advanced_settings` to the insert statement (line ~1115) now that the column exists:
```typescript
.insert({
  ...existing fields,
  advanced_settings: advanced_settings || {},
})
```

### 3. No changes needed in `process-signal-queue`
It already reads `run.advanced_settings` at lines 392 and 1492 — once the column exists and is populated, those reads will return real values instead of `{}`.

## Files Modified
- Database migration (new column)
- `supabase/functions/signal-planner/index.ts` — 1 line added to INSERT

## Estimated size
~5 lines changed

