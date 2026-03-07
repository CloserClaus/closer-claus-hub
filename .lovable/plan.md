

## Problem Analysis

Three distinct issues emerged from the autopsy:

### Issue 1: Records fetched exceeded the cap (934 instead of 100)
The planner correctly sets `maxItems: 100` and `limit: 100` in actor params. However, the runtime code in `process-signal-queue` at lines 941-950 has a secondary limit injection that can **override or add additional limit fields**:
```
if (maxField && !input[maxField]) input[maxField] = actor.inputSchema[maxField]?.default || 500;
```
This finds the first schema field containing "max" and sets it to the actor's default (which could be 500+). If the actor schema has a different limit field name than what the planner used, both get set — and the actor may honor the higher one. Additionally, `collectApifyResults` fetches ALL items from the dataset with no cap, so even if Apify returns more than requested, all records are ingested.

### Issue 2: Stage 1 searches are too broad (system-wide, not just job boards)
The planner prompt tells the AI to "start with the narrowest source" but never instructs it to embed **industry/vertical qualifiers** from the user's query into the actor search parameters. This applies to ALL actor types (job boards, Google Maps, business directories, etc.), not just hiring intent.

### Issue 3: Quality validation aborts too aggressively on small datasets
When max_results is set to 100, it's expected that a narrow dataset may have low relevance. The quality check rates data as "USELESS" and hard-aborts, but should instead differentiate between:
- "Data is irrelevant because Stage 1 queries were too broad" (fixable)
- "Data is irrelevant because the dataset is too small for this niche" (user should be told to broaden)

## Implementation Plan

### File: `supabase/functions/signal-planner/index.ts`

**1. Add Stage 1 Query Precision rules to the system prompt** (in `buildPipelinePlannerPrompt`)

Add a new section after `PIPELINE DESIGN RULES`:

```
## STAGE 1 QUERY PRECISION (CRITICAL)

When the user's goal targets a specific industry, vertical, company type, or niche:
1. ALWAYS include industry/vertical keywords directly in Stage 1 search parameters
   - Job boards: combine role + industry in search terms (e.g., "marketing agency sales representative" NOT just "sales representative")
   - Google Maps: include vertical in search query (e.g., "marketing agencies" NOT just "agencies")
   - Business directories: use industry-specific terms
2. If the actor's input schema has industry/category filter fields, USE THEM
3. The search_query field must reflect the full intent, not just one dimension
4. NEVER rely solely on downstream ai_filter stages to narrow by industry — the first stage must be as precise as possible
5. Stage 1 should capture ALL relevant signals while excluding obviously irrelevant ones at the source level
```

This is system-wide, not job-board-specific.

**2. Instruct the AI to check actor schema for industry filter fields**

Add to the prompt:
```
## ACTOR INPUT OPTIMIZATION

Before setting params_per_actor, check each actor's input schema for filtering capabilities:
- Industry/category fields (e.g., "industry", "category", "companyIndustry")
- Location fields — always set when the user specifies geography
- Date range fields — always set when temporal freshness matters
- Company size fields — set when user specifies small/medium/large

If an actor lacks an industry filter in its schema, embed industry keywords directly in the search query string instead.
```

### File: `supabase/functions/process-signal-queue/index.ts`

**3. Fix the runtime limit override that ignores planner-set caps** (lines 941-950)

Current code finds *any* schema field with "max" in its name and sets a default, potentially conflicting with planner-set limits. Fix: before applying the runtime default, check if the planner already set a recognized limit field.

```typescript
// Only inject a default limit if NO limit field was set by the planner
const plannerSetLimitFields = ["maxItems", "limit", "count", "maxResults", "max_results", "rows", "numResults"];
const hasExistingLimit = plannerSetLimitFields.some(f => input[f] !== undefined);

if (!hasExistingLimit) {
  if (hasSchema) {
    const maxField = schemaKeys.find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
    if (maxField) input[maxField] = actor.inputSchema[maxField]?.default || 500;
  } else {
    input.maxResults = 500;
  }
}
```

**4. Cap `collectApifyResults` to respect the intended limit**

Pass the expected max count to `collectApifyResults` and stop fetching once reached:

```typescript
async function collectApifyResults(datasetId: string, token: string, maxItems?: number): Promise<any[]> {
  const PAGE_SIZE = 500;
  let allItems: any[] = [];
  let offset = 0;
  while (true) {
    const resp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!resp.ok) throw new Error(`Apify collect failed (${resp.status})`);
    const items = await resp.json();
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
    if (maxItems && allItems.length >= maxItems) {
      allItems = allItems.slice(0, maxItems);
      break;
    }
    offset += PAGE_SIZE;
  }
  return maxItems ? allItems.slice(0, maxItems) : allItems;
}
```

Update all callsites to pass the stage's expected limit where applicable.

**5. Improve quality validation for small datasets** (in `pipelineQualityCheck`)

Add context about the dataset size relative to the user's max_results setting in the quality check prompt. When the dataset is small AND quality is USELESS, generate a user-friendly message suggesting they broaden their search rather than just aborting:

```
If quality is USELESS and the dataset is small (≤200 records):
→ Message: "The current dataset is too small and no relevant signals were found. Consider broadening your search criteria or increasing the max results per source."

If quality is USELESS and the dataset is large (>200 records):
→ Message: "Stage 1 returned many results but very few matched your criteria. The search terms may need to be more specific to your target industry."
```

This gives the user actionable guidance instead of a generic abort.

### Summary of changes

| File | Change | Purpose |
|------|--------|---------|
| `signal-planner/index.ts` | Add Stage 1 Query Precision + Actor Input Optimization prompt sections | System-wide industry filtering at source |
| `process-signal-queue/index.ts` | Fix runtime limit override logic | Prevent cap being overridden by schema defaults |
| `process-signal-queue/index.ts` | Cap `collectApifyResults` | Enforce max_results at collection time |
| `process-signal-queue/index.ts` | Improve quality validation messaging | Actionable user guidance for small datasets |

