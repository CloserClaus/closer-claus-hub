

## Signal Run Execution Trace — Run `4e1262dc`

### What the pipeline did step-by-step

| Phase | Stage | Count | Notes |
|-------|-------|-------|-------|
| Collecting | Raw leads inserted across 7 datasets | **1000+** | 7 Apify runs all SUCCEEDED (4 LinkedIn, 3 Indeed) |
| Finalizing | `loaded_raw_leads` | **1000** | **BUG**: Query has no `.limit()`, Supabase default caps at 1000 rows. Actual total may be higher. |
| Finalizing | `cross_keyword_dedup` | 1000 → **2** | **CRITICAL BUG**: 998 leads deleted. Only 2 survived. |
| Finalizing | `static_filter` | 1000 → 1000 | Re-fetch after dedup got another 1000 (unseen rows beyond the first 1000). No filter applied (filter only checks `industry contains Advertising`, missing data passes). |
| Finalizing | `ai_classification` | 1000 → **10** | AI correctly rejected 990/1000 as not being digital marketing agencies. |
| Finalizing | `workspace_dedup` | 418 → **0** | All 418 remaining leads matched the existing workspace dedup key `indeed.com`. |
| Final | Leads discovered | **0** | |

### Three Root Cause Bugs

**Bug 1 (Critical): Dedup key uses the job listing URL, not the company website**

The `website` outputField maps to `["companyUrl", "url", "employer.corporateWebsite"]` for Indeed. The `url` field is the Indeed job listing URL (e.g., `https://indeed.com/viewjob?jk=abc`). Since `companyUrl` is often empty, the normalizer picks `url` → domain = `indeed.com`.

The cross-keyword dedup key is: `domain || "${company_name}::${source}"`. When domain = `indeed.com` for ALL Indeed leads, they all collapse to one key. Same for LinkedIn leads if `companyUrl` resolves to `linkedin.com`. Result: 1000 leads → 2 (one per source).

The workspace dedup has an existing key `domain:indeed.com` from a prior run. So all remaining leads with domain `indeed.com` are marked as duplicates → 418 → 0.

**Bug 2: Supabase 1000-row default limit on signal_leads queries**

Lines 953-957 and 990-993 and 1068-1071 all query `signal_leads` with no `.limit()`. Supabase returns max 1000. If the collecting phase inserted more than 1000 leads total, the finalizer processes partial data and the counts across stages are inconsistent.

**Bug 3: outputFields priority puts job-listing URLs ahead of company URLs**

For Indeed: `website: ["companyUrl", "url", "employer.corporateWebsite"]` — `url` is the job listing URL, not the company website. It should be last or excluded.

For LinkedIn: `website: ["companyWebsite", "companyUrl"]` — `companyUrl` may be the LinkedIn company page. Should prefer `companyWebsite` only.

---

### Fix Plan

**File: `supabase/functions/process-signal-queue/index.ts`**

1. **Fix outputFields ordering** for Indeed and LinkedIn:
   - Indeed `website`: reorder to `["employer.corporateWebsite", "companyUrl"]` — remove `"url"` (the job listing URL). Add a separate `apply_link` for that.
   - LinkedIn `website`: keep `["companyWebsite"]` only, move `"companyUrl"` to `linkedin` field.

2. **Fix cross-keyword dedup key logic** (lines 969-988):
   - Exclude known job board domains from being used as dedup keys: `indeed.com`, `linkedin.com`, `yelp.com`, `yellowpages.com`, `google.com`.
   - When domain is a job board domain or empty, fall back to company_name-based key.
   - When company_name is also empty, treat the lead as unique (don't dedup it).

3. **Fix workspace dedup to exclude job board domains** (lines 1096-1113):
   - Same exclusion list. Don't match/store dedup keys for generic job board domains.

4. **Add explicit query limits** to all three `signal_leads` queries in `phaseFinalizing`:
   - Use `.limit(10000)` to ensure all leads are processed.

5. **Clean up stale dedup key**: Delete the `indeed.com` dedup key from `signal_dedup_keys` that's poisoning future runs.

**File: `supabase/functions/signal-planner/index.ts`**
   - Sync outputFields changes if duplicated there.

### Summary

The pipeline actually scraped ~1000+ leads successfully, but the dedup logic wiped them all because every lead's "website" resolved to `indeed.com` or `linkedin.com` (the job board URL, not the employer's URL). This is a data mapping bug, not a scraping bug. The fix is straightforward: correct the field priority, exclude job board domains from dedup keys, and raise query limits.

