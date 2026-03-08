

# Scrape Volume Control & AI Yield Estimation

## Current Flow (what exists today)

```text
Frontend                          Backend (signal-planner)              Cost Estimator
─────────                         ──────────────────────               ──────────────
target_leads: 100                 advanced_settings.max_results         estimatePipelineCost()
  ↓ computeSystemSettings()         _per_source = 500                    ↓
max_results_per_source = 500        ↓                                  Stage1 expected_output_count
  ↓                               Injected into AI prompt:              × filter pass_rates
advanced_settings sent to           "set max results to 500"             = estimated_leads
  signal-planner                    ↓
                                  Applied as cap to Stage 1 actors
                                    (lines 1232-1261)
```

The problem: the 5x multiplier is arbitrary. Niche queries might need 50x; broad queries need 2x.

## What Changes

### 1. Frontend — `SignalScraperTab.tsx`

**Replace "Target leads" dropdown with "Scrape volume" slider/select:**
- Options: 250 / 500 / 1,000 / 2,500 / 5,000 records
- This value maps directly to `max_results_per_source` — no multiplier
- Remove `computeSystemSettings()` function entirely — set `max_results_per_source = scrape_volume` inline
- Update `AdvancedSettings` interface: replace `target_leads: number` with `scrape_volume: number`
- Update `DEFAULT_ADVANCED`: `scrape_volume: 1000` (replaces `target_leads: 100`)
- Remove the hardcoded `estimatedScrapeCost` calculation on line 120

**Add yield display in `PipelinePlanDisplay`:**
- After the existing stats grid (lines 494-511), add a yield confidence row
- Read `estimation.yield_rate`, `estimation.yield_label`, `estimation.yield_guidance` from the plan response
- Show a badge: "Niche" (red-ish) / "Moderate" (yellow) / "Broad" (green)
- Show guidance text when yield < 5%: "Niche search — increase scrape volume for more results"

**Update `handleGenerate` (line 112-118):**
- Instead of `computeSystemSettings(advancedSettings)`, pass settings directly with `max_results_per_source: advancedSettings.scrape_volume`

**Update `handleRerun` (line 127-131):**
- Same change — direct mapping instead of `computeSystemSettings`

### 2. Backend — `signal-planner/index.ts`

**Update advanced settings injection (lines 1019-1062):**
- Read `scrape_volume` from `advanced_settings` (with fallback to `max_results_per_source` for backward compat)
- Change prompt line from "Target leads: X (set max results to Y)" to "Scrape volume: X records. Set Stage 1 maxItems to X."

**Update AI prompt output format (line 454-462):**
- Add `estimated_yield_rate` (float 0.01-0.60) to the required JSON output schema
- Add instruction: "Based on query specificity, estimate what percentage of Stage 1 results will survive all filters. Niche queries (biotech in Vermont hiring SDRs): 0.02-0.05. Moderate queries (marketing agencies hiring sales reps): 0.10-0.25. Broad queries (tech companies in California): 0.30-0.50."

**Update `estimatePipelineCost()` (lines 1682-1741):**
- Accept optional `estimated_yield_rate` from the AI plan
- If provided, use it: `totalEstimatedLeads = stage1_volume * estimated_yield_rate`
- If not provided (fallback), compute compound rate by multiplying all `expected_pass_rate` values from filter stages (current behavior)
- Return additional fields: `yield_rate`, `yield_label`, `yield_guidance`

**Yield label logic:**
```
yield_rate < 0.05  → "Niche"   + guidance: "Niche search — increase scrape volume for more results"
yield_rate < 0.20  → "Moderate" + guidance: null
yield_rate >= 0.20 → "Broad"   + guidance: "Broad search — you can reduce volume to save credits"
```

**Update response (lines 1310-1327):**
- Include `yield_rate`, `yield_label`, `yield_guidance` in the estimation object

### 3. Hook — `useSignalScraper.ts`

**Update `SignalEstimation` interface (lines 52-59):**
- Add `yield_rate?: number`, `yield_label?: string`, `yield_guidance?: string`

No other hook changes needed — the mutation already passes `advanced_settings` through transparently.

## Connection Points (ensuring nothing breaks)

1. **`AdvancedSettings` interface** is exported from `SignalScraperTab.tsx` — only used within that file. Safe to rename `target_leads` → `scrape_volume`.

2. **`advanced_settings` stored on `signal_runs` table** (line 1303 in planner): stored as JSONB, no schema enforcement. New field name works automatically.

3. **Stage 1 cap application** (lines 1232-1261): reads `advanced_settings.max_results_per_source` — we keep populating this field (= scrape_volume), so this code works unchanged.

4. **Rerun flow**: `handleRerun` re-generates with current `advancedSettings` — works because we just changed the field name in state.

5. **`estimatePipelineCost`** is only called in one place (line 1277) — the signature change (adding optional param) is backward compatible.

6. **`PipelinePlanDisplay`** already reads `estimation` object — adding new optional fields won't break existing display.

## Files Changed

| File | Change |
|------|--------|
| `src/components/leads/SignalScraperTab.tsx` | Replace target_leads with scrape_volume slider, remove computeSystemSettings, add yield display |
| `supabase/functions/signal-planner/index.ts` | Update AI prompt for yield_rate output, update settings injection, enhance estimatePipelineCost |
| `src/hooks/useSignalScraper.ts` | Add yield fields to SignalEstimation interface |

