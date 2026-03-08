

# Systemic Fix: Runtime Schema Authority Over Hardcoded Catalog

## Problem

The system has a fundamental trust hierarchy flaw. Verified actors in `VERIFIED_ACTOR_CATALOG` have hardcoded `inputSchema` types (e.g., `startUrls: "string[]"`), and the runtime schema fetch is **explicitly skipped** for these actors (line 1418: `if (!(actor as any)._verified)`). The normalizer then coerces inputs to match the wrong hardcoded type, breaking actor calls.

This is systemic because:
- Any new actor added to the catalog with a wrong type will silently break
- Actors can change their schema over time (Apify actors are third-party), making any hardcoded type eventually stale
- The same flaw exists in the backup actor path (line 623) but only for verified actors

## Solution: Always Fetch Runtime Schema, Use It as Source of Truth

Instead of skipping schema fetch for verified actors, **always fetch the runtime schema from Apify** and merge it with the catalog — runtime types override hardcoded types, while catalog provides fallback defaults (outputFields, labels, etc.).

### Changes in `supabase/functions/process-signal-queue/index.ts`

**1. New function: `fetchAndMergeRuntimeSchema(actor, token)`**

Fetches the actual input schema from Apify's API and merges type information into the actor's `inputSchema`. The catalog's field definitions (descriptions, defaults) are kept as fallbacks, but `type` always comes from the runtime schema when available.

This replaces the inline schema-fetch blocks at lines 1420-1442 and 623-643 with a single reusable function.

**2. Remove the `_verified` skip guard (line 1418-1442)**

Change:
```
if (!(actor as any)._verified && (!actor.inputSchema || ...))
```
To: always call `fetchAndMergeRuntimeSchema(actor, token)` for ALL actors. The function internally caches results (in-memory map keyed by actorId) so repeated calls in the same invocation don't re-fetch.

**3. In-memory schema cache**

Add a module-level `Map<string, Record<string, InputField>>` that stores fetched schemas by actorId. This prevents redundant API calls when the same actor is used across multiple stages or batches in a single invocation.

**4. Apply same pattern to backup actor path (line 623-643)**

Replace the inline schema fetch in `startApifyRunWithFallback` with the same `fetchAndMergeRuntimeSchema` call.

### Changes in `supabase/functions/signal-planner/index.ts`

No changes needed. The planner's catalog is used for planning only (actor selection, field mapping). The runtime schema override happens at execution time in `process-signal-queue`.

### What stays the same

- `VERIFIED_ACTOR_CATALOG` remains as-is — it provides outputFields, labels, categories, and fallback schema when Apify API is unreachable
- `normalizeInputToSchema()` is unchanged — it already works correctly when given accurate type info
- `buildGenericInput()` is unchanged
- All existing integration points where `normalizeInputToSchema` is called remain the same

### Edge cases handled

- **Apify API unreachable**: Falls back to hardcoded catalog schema (current behavior for verified actors)
- **Schema has no properties**: Falls back to catalog schema
- **Actor not on Apify Store** (custom/private): Falls back to catalog schema
- **Same actor used in multiple stages**: In-memory cache prevents re-fetching

### Files changed

| File | Change |
|------|--------|
| `process-signal-queue/index.ts` | Add `fetchAndMergeRuntimeSchema()` with in-memory cache; remove `_verified` skip guard; replace inline schema fetch in backup path |

