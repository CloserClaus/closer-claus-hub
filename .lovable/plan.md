

## Actor Selection: Registry-Based Approach

### Problem
Currently 5 actors are hardcoded. When a user query doesn't fit neatly into one of them, the AI either picks the wrong one or hallucinates parameters. Adding new actors requires code changes in 3 places (map, input builder, normalizer).

### Proposed Solution: Actor Catalog Registry

Instead of listing "all actors on Apify" (thousands, impractical), we maintain a **curated catalog of 15-20 vetted actors** as a structured constant in the edge function. Each entry contains the actor's real ID, input schema, output fields, and a description of what it's best for. The AI planner receives this full catalog in its system prompt and selects the best-fit actor by its `key`.

This eliminates the hardcoded switch statements — the input builder and normalizer become generic, driven by the catalog metadata.

### Actor Catalog Structure

```text
{
  key: "linkedin_jobs_v2",
  actorId: "AtsAgajsFjMVfxXJZ",
  label: "LinkedIn Jobs (Sovereign Taylor)",
  category: "hiring_intent",
  description: "Scrapes LinkedIn job postings. Best for hiring intent signals.",
  inputSchema: {
    keyword: { type: "string", required: true, description: "Job search term" },
    location: { type: "string", default: "United States" },
    maxResults: { type: "number", default: 100, max: 500 },
    timePosted: { type: "enum", values: ["pastDay","pastWeek","pastMonth"], default: "pastWeek" },
    scrapeJobDetails: { type: "boolean", default: true }
  },
  outputFields: {
    company_name: ["companyName", "company"],
    website: ["companyLink", "companyUrl"],
    location: ["jobLocation", "location"],
    phone: [],
    email: ["email", "contactEmail"],
    linkedin: ["companyLink"],
    description: ["jobDescription", "description"]
  }
}
```

### How It Works

1. **AI Planner** receives the full catalog in its system prompt. Instead of picking from 5 source names, it picks an `actor_key` from the catalog and constructs `search_params` using only the fields defined in that actor's `inputSchema`.

2. **Input Builder** becomes generic: reads the selected actor's `inputSchema` from the catalog, maps `search_params` to valid fields, applies defaults for missing ones, enforces max limits.

3. **Result Normalizer** becomes generic: reads the actor's `outputFields` mapping and extracts values by trying each field name in order (e.g., for `company_name`, try `item.companyName` then `item.company`).

4. **Adding a new actor** = adding one entry to the catalog array. No switch cases, no new functions.

### Catalog Contents (Initial ~15 actors)

| Category | Actor | Use Case |
|----------|-------|----------|
| Hiring Intent | LinkedIn Jobs (Sovereign Taylor) | Companies hiring for specific roles |
| Hiring Intent | Indeed Jobs Scraper | Broader job board coverage |
| Company Data | LinkedIn Company Scraper | Enrich company profiles |
| Company Data | Crunchbase Scraper | Startup/funding data |
| Local Business | Google Maps Scraper | Local service businesses |
| Local Business | Yelp Scraper | Local businesses with reviews |
| Local Business | Yellow Pages Scraper | Traditional business listings |
| People | LinkedIn People Scraper | Find founders/decision-makers |
| Web Search | Google Search Scraper | General web search |
| Directories | Clutch Scraper | Agency directories |
| Directories | G2 Scraper | Software company listings |
| Social | Instagram Profile Scraper | Social presence data |
| Social | Facebook Pages Scraper | Business pages |
| Reviews | Trustpilot Scraper | Company reviews |
| E-commerce | Shopify Store Scraper | E-commerce businesses |

We start with actors we can verify have correct IDs and schemas. Others get added incrementally after testing.

### Changes

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Replace `APIFY_ACTOR_MAP`, `buildActorInput`, `normaliseResults` with catalog-driven generic versions. Update AI system prompt to include full catalog. |

No database changes needed — the catalog lives in code since it changes rarely and must be version-controlled.

