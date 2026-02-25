

# Website Analytics Module for Admin Panel

## Overview

Build a full-stack analytics system that tracks all user activity across the platform and surfaces it in a rich admin dashboard. The system will capture page views, active sessions (with heartbeat for live "online" status), device/browser info, and geographic data.

## Database Design

### Table 1: `page_views`
Stores every page navigation event.

```text
page_views
├── id (uuid, PK)
├── user_id (uuid, nullable - for anonymous visitors)
├── session_id (text - browser-generated session ID)
├── path (text - e.g. "/dashboard", "/crm")
├── referrer (text, nullable)
├── user_agent (text, nullable)
├── screen_width (int, nullable)
├── screen_height (int, nullable)
├── language (text, nullable)
├── timezone (text, nullable)
├── country (text, nullable)
├── city (text, nullable)
├── created_at (timestamptz, default now())
```

RLS: Anon/authenticated can INSERT (own user_id or null). Only platform_admin can SELECT.

### Table 2: `active_sessions`
Tracks who is currently online via heartbeat (upsert every 30s, prune stale > 2min).

```text
active_sessions
├── id (uuid, PK)
├── user_id (uuid, nullable)
├── session_id (text, unique)
├── current_path (text)
├── user_agent (text, nullable)
├── last_seen_at (timestamptz, default now())
├── started_at (timestamptz, default now())
├── country (text, nullable)
├── city (text, nullable)
```

RLS: Anon/authenticated can INSERT/UPDATE (own session). Only platform_admin can SELECT all.

## Edge Function: `track-pageview`

A lightweight edge function (`verify_jwt = false`) that:
1. Accepts `{ path, referrer, session_id, screen_width, screen_height, language, timezone, user_id? }`
2. Resolves country/city from the request IP using the `cf-ipcountry` header (available on Cloudflare/Deno Deploy) or falls back to timezone-based inference
3. Inserts into `page_views`
4. Upserts into `active_sessions` (heartbeat)

Using an edge function avoids RLS complexity and allows IP-based geo resolution server-side.

## Frontend Tracking

### Hook: `usePageTracking` (placed in `DashboardLayout` and public pages)
- Generates a persistent `session_id` via `sessionStorage`
- On every route change (via `useLocation`), fires a beacon to `track-pageview`
- Sets up a 30-second heartbeat interval that upserts `active_sessions`
- On `beforeunload`, sends a final beacon

### Tracking Scope
- **Authenticated pages**: Tracked via `DashboardLayout` (all dashboard routes)
- **Public pages**: Add tracking to `PublicOfferDiagnostic`, `PublicOfferDiagnosticResults`, `HomePage` via a lightweight wrapper component

## Admin Analytics Dashboard

### New tab: `analytics` in the admin panel

**Components**:

1. **Live Stats Bar** — Users online now, active sessions count, current pages breakdown
2. **Traffic Over Time** — Recharts line chart showing page views per hour/day (selectable period: today, 7d, 30d)
3. **Top Pages** — Bar chart of most visited pages
4. **Geographic Breakdown** — Table showing visits by country/city
5. **Device & Browser Stats** — Parsed from user_agent, shown as pie/donut charts
6. **User Activity Table** — Scrollable table of recent page views with user name, path, timestamp, location
7. **Active Users List** — Real-time list of who is online right now, what page they're on, how long they've been active

### Data fetching
- Uses `@tanstack/react-query` with polling (30s refetch for live data)
- Aggregation queries via Supabase `.select()` with grouping done client-side, or via database functions for heavy aggregations

## File Changes

| File | Action |
|------|--------|
| `supabase/functions/track-pageview/index.ts` | Create — edge function for recording page views + heartbeat |
| `supabase/config.toml` | Edit — add `[functions.track-pageview] verify_jwt = false` |
| `src/hooks/usePageTracking.ts` | Create — tracking hook with route change detection + heartbeat |
| `src/components/layout/DashboardLayout.tsx` | Edit — add `usePageTracking()` call |
| `src/components/admin/SiteAnalytics.tsx` | Create — full analytics dashboard component |
| `src/pages/AdminDashboard.tsx` | Edit — add `analytics` tab + import |
| `src/components/layout/AppSidebar.tsx` | Edit — add Analytics nav item to admin sidebar |
| DB migration | Create `page_views` and `active_sessions` tables with RLS policies |
| `src/pages/HomePage.tsx` | Edit — add tracking hook for public page |
| `src/pages/PublicOfferDiagnostic.tsx` | Edit — add tracking hook for public page |
| `src/pages/PublicOfferDiagnosticResults.tsx` | Edit — add tracking hook for public page |

## Technical Notes

- The `track-pageview` edge function uses `verify_jwt = false` since it must work for both authenticated and anonymous visitors
- Geographic data is derived server-side from request headers (`x-forwarded-for`, `cf-ipcountry`) — no third-party API needed for country-level data
- The heartbeat approach (30s interval + 2min stale threshold) gives accurate "users online" counts without WebSocket overhead
- User agent parsing will be done client-side in the admin component using regex patterns for browser/OS detection
- A database function `cleanup_stale_sessions()` will be created to prune sessions older than 2 minutes, called by the edge function on each heartbeat

