

# Schema-Aware Input Normalization — Thorough Scope Analysis & Plan

## Problem Summary

The system constructs `startUrls` as `[{ url: "..." }]` (object arrays) in **6 locations**, but some Apify actors expect `startUrls` as `["..."]` (plain string arrays). There is no reconciliation layer between what the code constructs and what the actor's schema actually declares.

## All Affected Code Points

### File: `supabase/functions/process-signal-queue/index.ts`

| Line | Context | Current Format | Risk |
|------|---------|---------------|------|
| 222 | `buildPlatformSearchQuery` LinkedIn case | `startUrls: [{ url }]` | Stage 1 discovery — **root cause of the 1-result bug** |
| 1574 | People data structured mode (startUrls fallback) | `map(e => ({ url: ... }))` | Stage 5 people enrichment |
| 1582-1584 | Structured fallback when no company/title fields | `map(e => ({ url: ... }))` | Stage 5 fallback path |
| 1594 | Enrichment with schema (`actor.inputSchema["startUrls"]` exists) | `batch.map(url => ({ url }))` | Stages 3-6 enrichment batches |
| 1603 | Schema exists but no common field matches | `batch.map(url => ({ url }))` | Edge case fallback |
| 1610 | No schema at all — shotgun approach | `batch.map(url => ({ url }))` | Unknown actor fallback |

### File: `supabase/functions/signal-planner/index.ts`

| Line | Issue |
|------|-------|
| 1582 | Schema parser flattens `type: "array"` → `"string[]"` regardless of `items` sub-schema |

### File: `supabase/functions/process-signal-queue/index.ts`

| Line | Issue |
|------|-------|
| 1344 | Same schema flattening: `val.type === "array" ? "string[]"` |
| 549 | Same in backup actor runtime schema fetch |

## Edge Cases & Risks to Address

1. **Some actors genuinely expect `[{ url: "..." }]`** — Apify's own actors (e.g., `apify/web-scraper`) use the `RequestList` format where `startUrls` is `Array<{ url: string }>`. Blindly converting everything to plain strings would **break those actors**.

2. **The `urls` field is always plain strings** — When the code sends both `startUrls` and `urls`, the `urls` field is already correct (`batch` as-is). Only `startUrls` has the format ambiguity.

3. **Verified actors have hardcoded schemas** — The `VERIFIED_ACTOR_CATALOG` declares `startUrls: { type: "string[]" }` for LinkedIn Jobs Scraper, but the normalizer must still work for dynamically discovered actors.

4. **No-schema fallback (line 1607-1616)** — When schema is completely unknown, the system sends both formats. The normalizer can't help here since there's nothing to normalize against. This is acceptable — keep sending both.

5. **`buildGenericInput` passthrough** — When `inputSchema` is empty, it passes ALL params through (line 443-445). The normalizer must run **after** `buildGenericInput`, not inside it.

## Solution Design

### 1. Enhanced Schema Parsing (both files)

Change the type inference from:
```
val.type === "array" ? "string[]"
```
To inspect `val.items` to distinguish:
- `{ type: "array", items: { type: "string" } }` → `"string[]"`
- `{ type: "array", items: { type: "object" } }` → `"object[]"` (new type)
- `{ type: "array" }` (no items) → `"string[]"` (safe default — most common)

This requires adding `"object[]"` to the `InputField.type` union in both files.

### 2. `normalizeInputToSchema()` Function

Add to `process-signal-queue/index.ts`, called **after** `buildGenericInput` and **before** `startApifyRun` at every call site.

Logic per field:
- If schema declares `type: "string[]"` and value is `[{ url: "..." }, ...]` → extract to `["...", ...]`
- If schema declares `type: "object[]"` and value is `["...", ...]` → wrap to `[{ url: "..." }, ...]`
- If schema declares `type: "number"` and value is string → `parseFloat`
- If schema declares `type: "string"` and value is array → take first element
- If schema declares `type: "string[]"` and value is a single string → wrap `[value]`
- If field not in schema → pass through unchanged
- If schema is empty → skip normalization entirely (preserve shotgun approach)

Detection of object-URL arrays: check if `Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0]?.url`.

### 3. Integration Points (4 call sites)

All calls to `startApifyRunWithFallback` or `startApifyRun` must pass through normalization:

1. **Stage 1 discovery** (line ~1389-1400): After `buildGenericInput`, before `startApifyRunWithFallback`
2. **LinkedIn URL discovery batches** (line ~1440-1444): After `buildGenericInput`
3. **Enrichment batches** (line ~1619-1623): After `buildGenericInput`
4. **Backup actor fallback** (line ~558-560): After `buildGenericInput` inside `startApifyRunWithFallback`

### 4. Logging

Log every coercion: `Schema coercion: field "startUrls" object[] → string[] for actor {actorId}` — enables debugging without code changes.

## What This Does NOT Change

- **Verified actor catalog schemas** — Already correct; normalizer validates against them
- **`buildPlatformSearchQuery`** — Still constructs `startUrls: [{ url }]`; the normalizer fixes it downstream. No need to change construction logic (keeps it simple).
- **`buildGenericInput`** — Unchanged; still filters by schema fields
- **No-schema fallback paths** — When `inputSchema` is empty, normalization is skipped; the shotgun approach remains
- **`urls` field** — Already plain strings everywhere; no change needed

## Files Changed

| File | Changes |
|------|---------|
| `process-signal-queue/index.ts` | Add `"object[]"` to `InputField.type` union; add `normalizeInputToSchema()` function; integrate at 4 call sites; enhance runtime schema parsing at lines 549 and 1344 |
| `signal-planner/index.ts` | Add `"object[]"` to `InputField.type` union; enhance schema parsing at line 1582 to inspect `val.items` |

