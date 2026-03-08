

# Make Signal Templates Viable with Apify + AI Filtering Stack

## Problem
The 6 marketing templates have `query_template` values written as Google search operators (`site:linkedin.com/jobs`, `site:google.com/maps "1 star"`, etc.), but they're used as **natural language prompts** for the AI pipeline planner. This causes two failures:

1. **Actor discovery misses**: `extractComprehensiveSearchTerms()` doesn't have keyword triggers for "review", "e-commerce", "shopify", "funded", "crunchbase", "social media", "traffic", "new business", etc. — so the planner can't find relevant Apify actors.
2. **AI confusion**: The planner AI receives Google search syntax instead of a clear intent description, leading to poor pipeline designs.

## Plan

### 1. Rewrite all 6 `query_template` values (DB update)

Replace Google-search-operator queries with clear natural language that the AI planner can reason about and that `extractComprehensiveSearchTerms` can parse:

| Template | Current (broken) | New (viable) |
|---|---|---|
| Hiring for Marketing Roles | `site:linkedin.com/jobs OR site:indeed.com "marketing manager"...` | `Find companies hiring marketing managers, marketing coordinators, or CMO roles {{location}}` |
| New Businesses Without Websites | `"new business" OR "just launched"...` | `Find new local businesses recently opened or registered that may need a website {{location}} {{industry}}` |
| Poor Google Reviews | `site:google.com/maps "1 star"...` | `Find local businesses on Google Maps with low ratings or few reviews {{location}} {{industry}}` |
| Hiring but No Social Media | `site:indeed.com... -site:instagram.com...` | `Find companies posting job ads on job boards {{industry}} {{location}}` |
| E-commerce Low Traffic | `site:shopify.com OR "powered by WooCommerce"...` | `Find e-commerce stores and online shops on Shopify or WooCommerce {{industry}} {{location}}` |
| Recently Funded | `"raised" OR "funding round"... site:crunchbase.com` | `Find startups and companies that recently raised funding or completed a funding round {{industry}} {{location}}` |

### 2. Add missing keyword triggers in `extractComprehensiveSearchTerms()` (signal-planner edge function)

Add these new keyword → search term mappings so the right Apify actors get discovered:

```text
"review" / "rating"       → "google maps scraper", "review scraper"
"ecommerce" / "shopify"   → "shopify scraper", "ecommerce scraper"
"funded" / "funding"      → "crunchbase scraper", "startup scraper"
"social media"            → "social media scraper", "instagram scraper"
"new business" / "opened" → "google maps scraper", "business directory"
"traffic" / "seo"         → "website crawler", "seo scraper"
```

### 3. Add `plan_override` hints for complex templates (DB update)

For templates requiring multi-step logic that the AI might miss, add `plan_override` guidance:

- **Poor Google Reviews**: hint to use Google Maps scraper with rating filters, then AI filter for low ratings
- **Hiring but No Social Media**: hint to scrape job boards first, then AI filter to flag companies lacking social profiles
- **E-commerce Low Traffic**: hint to discover Shopify/WooCommerce stores, then AI filter for low-authority signals

### Files Modified
- `supabase/functions/signal-planner/index.ts` — add ~15 lines of keyword triggers in `extractComprehensiveSearchTerms()`
- Database `signal_templates` table — update 6 rows (query_template + plan_override)
