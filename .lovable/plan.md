

# Fix: LinkedIn hiring intent search drops industry context and misinterprets user queries

## Problem

Two issues cause incorrect search results:

1. **Worker drops industry context for LinkedIn URLs.** In `process-signal-queue/index.ts` lines 1098-1113, when `roleFilter` exists, the `searchKeyword` is set to just `keyword` (role titles like "Sales Representative OR SDR"). The `industryContext` (e.g., "marketing") is never appended to the LinkedIn search URL. The search effectively becomes "Sales Representative" with no industry qualifier -- returning irrelevant results from all industries.

2. **Plan's pre-built URLs override worker-constructed ones.** Line 1109 uses `input.urls = input.urls || [searchUrl]`, so if the AI planner already set `urls` in `params_per_actor`, the worker's locally constructed URL is ignored entirely.

3. **Planner prompt example is too narrow.** The prompt example says `search_query: "marketing agency OR advertising agency"` for a hiring intent query. This biases the AI to use narrow business types ("agency") instead of broad industry terms ("marketing industry"). When a user says "companies in the marketing industry", the AI should generate `search_query: "marketing"` or `"marketing industry"`, not "marketing agency".

## Fix (2 files)

### A) `supabase/functions/process-signal-queue/index.ts` -- Worker URL construction

**Lines 1098-1113:** When `roleFilter` exists for LinkedIn, combine role titles AND industry context into the search URL keyword. Force-override any plan-provided URLs.

```typescript
if (actor.actorId.includes("linkedin") || actor.label.toLowerCase().includes("linkedin")) {
  const location = input.location || input.searchLocation || "United States";
  // Combine role titles with industry context for accurate search
  const searchKeyword = industryContext 
    ? `${keyword} ${industryContext}` // "Sales Representative OR SDR marketing"
    : keyword;
  const encodedKeyword = encodeURIComponent(searchKeyword);
  const encodedLocation = encodeURIComponent(location);
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}&f_TPR=r604800`;
  // Always override plan URLs -- they may lack industry context
  input.urls = [searchUrl];
  input.startUrls = [{ url: searchUrl }];
  input.splitByLocation = false;
  delete input.splitCountry;
}
```

Same pattern for the Indeed branch (lines 1114-1130): ensure `industryContext` is combined into the search query, not just set as a separate `company` field that Indeed may ignore.

### B) `supabase/functions/signal-planner/index.ts` -- Planner prompt

Update the prompt example (lines 360-374) to clarify that `search_query` should match the user's intent breadth:

```
Example 1 (specific business type):
- User: "Find marketing agencies hiring SDRs"
- search_query: "marketing agency OR advertising agency"
- role_filter: ["SDR", "Sales Development Representative"]

Example 2 (broad industry):
- User: "Find companies in the marketing industry hiring sales reps"
- search_query: "marketing OR advertising OR digital marketing"
- role_filter: ["Sales Representative", "Account Executive", "Sales Manager"]

IMPORTANT: Match the user's intent. "Companies in the marketing industry" is BROADER than "marketing agencies".
Use industry terms, not business-type terms, when the user says "industry" or "companies in X".
```

This ensures the AI generates appropriate breadth in `search_query` and the worker always includes industry context in the actual search URL.

