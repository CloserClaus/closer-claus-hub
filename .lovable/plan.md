

# Fix: Missing `discoverActors` function in signal-planner

## Root Cause
The `discoverActors` function is called at line 527 of `signal-planner/index.ts` but was never defined in the current file. When the `VERIFIED_ACTORS` catalog was removed, the `discoverActors` function that previously existed alongside it was also removed — but the call to it in `resolveActorsForPipeline` was kept. The deployed version has a stale copy with a broken `.upsert(...).catch()` chain causing the `TypeError`.

## Fix
Add the `discoverActors` function back into `signal-planner/index.ts`. It needs to:

1. Search the Apify Store API for actors matching a search term
2. Sort results by composite quality score: `(monthlyUsers * 0.4) + (totalRuns * 0.0003) + (rating * 200)` — prioritizing popular, well-reviewed actors
3. Fetch each actor's input schema from `https://api.apify.com/v2/acts/{id}` 
4. Map results into `ActorEntry` objects with `inputSchema`, `outputFields`, and metadata
5. Cache results in `signal_actor_cache` table (with proper async error handling — use `.then()` instead of `.catch()` on the upsert promise, or just `await` it in a try/catch)

The function should be placed between `preflightValidateActor` (ends ~line 709) and `normaliseGenericResults` (starts ~line 712), or after the helper functions block.

### Implementation Details

```typescript
async function discoverActors(searchTerm: string, serviceClient: any): Promise<ActorEntry[]> {
  const token = Deno.env.get("APIFY_API_TOKEN")!;
  console.log(`Discovering actors for: "${searchTerm}"`);

  // 1. Check cache first (7-day TTL)
  const { data: cached } = await serviceClient
    .from("signal_actor_cache")
    .select("*")
    .eq("search_term", searchTerm)
    .gte("cached_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(10);

  if (cached && cached.length > 0) {
    return cached.map((c: any) => c.actor_data as ActorEntry);
  }

  // 2. Search Apify Store
  const resp = await fetch(
    `https://api.apify.com/v2/store?token=${token}&search=${encodeURIComponent(searchTerm)}&limit=10&sortBy=popularity`,
    { method: "GET" }
  );
  if (!resp.ok) throw new Error(`Store search failed: ${resp.status}`);
  const storeData = await resp.json();
  const actors = storeData.data?.items || [];

  // 3. Sort by composite quality score
  actors.sort((a: any, b: any) => {
    const scoreA = (a.stats?.totalUsers30Days || 0) * 0.4 
                 + (a.stats?.totalRuns || 0) * 0.0003 
                 + (a.stats?.rating || 0) * 200;
    const scoreB = (b.stats?.totalUsers30Days || 0) * 0.4 
                 + (b.stats?.totalRuns || 0) * 0.0003 
                 + (b.stats?.rating || 0) * 200;
    return scoreB - scoreA;
  });

  // 4. Map to ActorEntry (fetch schemas for top 5)
  const entries: ActorEntry[] = [];
  for (const actor of actors.slice(0, 5)) {
    const actorId = `${actor.username}/${actor.name}`;
    let inputSchema: Record<string, InputField> = {};
    
    try {
      const schemaResp = await fetch(
        `https://api.apify.com/v2/acts/${actorId.replace("/", "~")}?token=${token}`
      );
      if (schemaResp.ok) {
        const actorDetail = await schemaResp.json();
        // Parse input schema from actor detail
        const rawSchema = actorDetail.data?.defaultRunInput || 
                          actorDetail.data?.exampleRunInput || {};
        // Build minimal schema from available info
        for (const [key, val] of Object.entries(rawSchema)) {
          inputSchema[key] = {
            type: Array.isArray(val) ? "string[]" : typeof val as any,
            description: key,
            default: val,
          };
        }
      }
    } catch { /* continue without schema */ }

    entries.push({
      key: actorId.replace("/", "_"),
      actorId,
      label: actor.title || actor.name,
      category: searchTerm,
      description: actor.description || "",
      inputSchema,
      outputFields: {},
      monthlyUsers: actor.stats?.totalUsers30Days || 0,
      totalRuns: actor.stats?.totalRuns || 0,
      rating: actor.stats?.rating || 0,
    });
  }

  // 5. Cache results (fire-and-forget with proper error handling)
  for (const entry of entries) {
    try {
      await serviceClient.from("signal_actor_cache").upsert({
        search_term: searchTerm,
        actor_id: entry.actorId,
        actor_data: entry,
        cached_at: new Date().toISOString(),
      }, { onConflict: "search_term,actor_id" });
    } catch (cacheErr) {
      console.warn(`Cache write failed for ${entry.actorId}:`, cacheErr);
    }
  }

  return entries;
}
```

### Key Difference from Old Code
The old (deployed) version used `.upsert(...).catch(...)` which is invalid because Supabase's `upsert()` returns a `PostgrestFilterBuilder`, not a native Promise with `.catch()`. The fix wraps it in `try/await/catch` instead.

### File Changed
| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Add `discoverActors()` function (~70 lines, placed before `normaliseGenericResults`) |

