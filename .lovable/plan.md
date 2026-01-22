

# Master Leads Caching System Implementation Plan

## Overview

This plan implements a centralized "Master Leads" database that stores all enriched leads globally. When users request enrichment, the system will first check if the lead already exists in the master database (using LinkedIn URL as the unique identifier) before making API calls to Apollo. This saves credits and provides faster enrichment for overlapping leads.

## Current Architecture Understanding

- **apollo_leads table**: Workspace-scoped leads from search results, with `enrichment_status` (searched/pending/enriched)
- **apollo-search function**: Searches Apollo API and saves results per workspace
- **apollo-enrich function**: Enriches leads by calling Apollo's People Match API, deducts credits
- **Admin panel**: Already has an "Apollo Leads" tab showing per-workspace leads

## Proposed Solution

### Phase 1: Database Schema

Create a new `master_leads` table that stores globally unique enriched leads:

```text
master_leads table:
+----------------------+---------------------------+
| Column               | Type                      |
+----------------------+---------------------------+
| id                   | uuid (PK)                 |
| linkedin_url         | text (UNIQUE, NOT NULL)   |
| apollo_id            | text                      |
| first_name           | text                      |
| last_name            | text                      |
| email                | text                      |
| email_status         | text                      |
| phone                | text                      |
| phone_status         | text                      |
| company_name         | text                      |
| company_domain       | text                      |
| company_linkedin_url | text                      |
| title                | text                      |
| seniority            | text                      |
| department           | text                      |
| city                 | text                      |
| state                | text                      |
| country              | text                      |
| industry             | text                      |
| employee_count       | text                      |
| first_enriched_at    | timestamptz               |
| last_updated_at      | timestamptz               |
| enrichment_count     | integer (default 1)       |
| created_at           | timestamptz               |
+----------------------+---------------------------+
```

**Key design decisions:**
- `linkedin_url` is the unique identifier (more reliable than name matching)
- `enrichment_count` tracks how many times this lead has been used (useful for analytics)
- RLS policies: Platform admins have full access; service role for edge functions

### Phase 2: Enrichment Flow Modification

Update the `apollo-enrich` edge function with this new logic:

```text
Enrichment Flow:
+-------------------+     +----------------------+     +------------------+
| User requests     | --> | Check master_leads   | --> | Lead found?      |
| enrichment        |     | by linkedin_url      |     |                  |
+-------------------+     +----------------------+     +-------+----------+
                                                               |
                          +------------------------------------+
                          |                                    |
                          v                                    v
                    +-----+------+                      +------+------+
                    | YES: Copy  |                      | NO: Call    |
                    | from master|                      | Apollo API  |
                    | (FREE)     |                      | (5 credits) |
                    +-----+------+                      +------+------+
                          |                                    |
                          v                                    v
                    +-----+------+                      +------+------+
                    | Update     |                      | Save to     |
                    | apollo_lead|                      | master_leads|
                    | status     |                      | + apollo    |
                    +------------+                      +-------------+
```

**Logic changes in apollo-enrich:**
1. For each lead to enrich, first query `master_leads` by `linkedin_url`
2. If found → copy enriched data, mark as "enriched", NO credit charge
3. If not found → call Apollo API, save to `master_leads`, charge credits
4. Track stats: `enriched_from_cache` vs `enriched_from_api`
5. Return detailed response showing credits saved

### Phase 3: Admin Panel - Master Leads Table

Create new component `MasterLeadsTable.tsx` for the admin dashboard:

**Features:**
- Display all master leads alphabetically (by last_name, then first_name)
- Search by name, company, email, LinkedIn URL
- Show enrichment_count (popularity metric)
- Show first_enriched_at and last_updated_at
- Export functionality (optional enhancement)
- Stats cards: Total leads, Credits saved, Most used leads

**Navigation:**
- Add "Master Leads" to admin sidebar nav
- Add new tab `master` to AdminDashboard switch

### Phase 4: Response Updates

Modify enrichment response to include cache statistics:

```text
Response structure:
{
  success: true,
  enriched_count: 50,
  from_cache: 35,        // Leads enriched from master_leads
  from_api: 15,          // Leads enriched via Apollo API
  credits_used: 75,      // Only for API calls (15 × 5)
  credits_saved: 175,    // Cache hits (35 × 5)
  remaining_credits: 425
}
```

Update `EnrichmentDialog.tsx` to show cache savings:
- "35 leads enriched instantly from cache"
- "15 leads enriched via API"
- "You saved 175 credits!"

---

## Technical Implementation Details

### 1. Database Migration

```sql
-- Create master_leads table
CREATE TABLE public.master_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  apollo_id text,
  first_name text,
  last_name text,
  email text,
  email_status text,
  phone text,
  phone_status text,
  company_name text,
  company_domain text,
  company_linkedin_url text,
  title text,
  seniority text,
  department text,
  city text,
  state text,
  country text,
  industry text,
  employee_count text,
  first_enriched_at timestamptz DEFAULT now(),
  last_updated_at timestamptz DEFAULT now(),
  enrichment_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_master_leads_linkedin_url ON public.master_leads(linkedin_url);
CREATE INDEX idx_master_leads_name ON public.master_leads(last_name, first_name);

-- Enable RLS
ALTER TABLE public.master_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Platform admins can view all master leads"
  ON public.master_leads FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Service role can manage master leads"
  ON public.master_leads FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 2. Edge Function Updates (apollo-enrich)

Key modifications:
- Before enriching, query `master_leads` for each lead's `linkedin_url`
- Separate leads into "cacheable" vs "needs API"
- For cache hits: copy data, increment `enrichment_count`
- For API calls: enrich and upsert to `master_leads`
- Return detailed breakdown of cache vs API enrichments

### 3. Frontend Updates

**Files to create:**
- `src/components/admin/MasterLeadsTable.tsx`

**Files to modify:**
- `src/pages/AdminDashboard.tsx` - Add master tab case
- `src/components/layout/AppSidebar.tsx` - Add nav item
- `src/hooks/useApolloSearch.ts` - Update EnrichmentProgress type
- `src/components/leads/EnrichmentDialog.tsx` - Show cache stats

### 4. Admin Sidebar Navigation

Add new nav item for Master Leads:
```typescript
{
  title: 'Master Leads',
  url: '/admin?tab=master',
  icon: Database
}
```

---

## Summary

| Component | Action | Description |
|-----------|--------|-------------|
| `master_leads` table | Create | Global unique lead storage |
| `apollo-enrich` function | Modify | Check cache before API calls |
| `MasterLeadsTable.tsx` | Create | Admin view for master data |
| `AdminDashboard.tsx` | Modify | Add master tab |
| `AppSidebar.tsx` | Modify | Add Master Leads nav |
| `EnrichmentDialog.tsx` | Modify | Show cache savings |
| `useApolloSearch.ts` | Modify | Track cache stats |

