

# Advanced Analytics with Real-Time World Map

## Overview

Enhance the admin analytics dashboard with a real-time SVG world map showing user locations as animated dots, plus advanced metrics like bounce rate, average session duration, referrer breakdown, page flow analysis, and a live visitor feed with geographic coordinates.

## Architecture

### 1. Database Changes

Add `latitude` and `longitude` columns to both `page_views` and `active_sessions` tables so the map can plot precise dots.

```sql
ALTER TABLE page_views ADD COLUMN latitude numeric, ADD COLUMN longitude numeric;
ALTER TABLE active_sessions ADD COLUMN latitude numeric, ADD COLUMN longitude numeric;
```

### 2. Edge Function Enhancement (`track-pageview`)

Enhance IP-to-geo resolution. Since Deno Deploy / Supabase edge functions run behind Cloudflare, we get `cf-ipcountry`. For latitude/longitude, we'll add a country-code-to-centroid mapping directly in the edge function (lightweight, no external API needed). This gives us approximate country-center coordinates for every visitor without any third-party service.

The edge function will:
- Map country codes to lat/lng centroids (e.g., US → 39.8, -98.5)
- Store lat/lng on both `page_views` and `active_sessions`

### 3. World Map Component

Build a pure SVG world map component (`WorldMapVisualization`) with no external dependencies:
- Simplified world outline as an SVG path (equirectangular projection)
- Animated pulsing dots for active sessions (real-time, 15s refetch)
- Static dots for historical page views (heatmap density)
- Country hover tooltips showing visitor count
- Color-coded dots: green for live users, blue for historical
- Responsive container that scales to any width

### 4. Advanced Analytics Metrics

Add these new data points to the dashboard:

**Bounce Rate** — Sessions with only 1 page view / total sessions  
**Avg Session Duration** — Estimated from first-to-last page view per session  
**Referrer Breakdown** — Bar chart of top traffic sources (direct, google, social, etc.)  
**New vs Returning** — Pie chart based on session_id uniqueness across time  
**Page Flow / Top Entry Pages** — Which pages users land on first  
**Peak Hours Heatmap** — Grid showing traffic density by day-of-week × hour  
**Engagement Score** — Pages per session metric

### 5. UI Layout

The enhanced analytics page will be organized in sections:

```text
┌─────────────────────────────────────────────┐
│  [Live Stats Bar - Online / Views / etc.]    │
├─────────────────────────────────────────────┤
│  [    WORLD MAP - Full Width, ~300px h     ] │
│  [  Green dots = live    Blue = historical ] │
├──────────────────────┬──────────────────────┤
│  Traffic Over Time   │  Bounce Rate / Avg   │
│  (Line Chart)        │  Duration / Pages/   │
│                      │  Session Cards       │
├──────────────────────┼──────────────────────┤
│  Top Pages           │  Referrer Breakdown  │
│  (Bar Chart)         │  (Bar Chart)         │
├──────────────────────┼──────────────────────┤
│  Peak Hours Heatmap  │  Geographic Breakdown│
│  (Day × Hour Grid)   │  (Country list)      │
├──────────┬───────────┼──────────────────────┤
│ Browsers │ Devices   │ Operating Systems    │
├──────────┴───────────┴──────────────────────┤
│  Active Users Table                          │
│  Recent Page Views Table                     │
└─────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| DB migration | Create | Add `latitude`, `longitude` to `page_views` and `active_sessions` |
| `supabase/functions/track-pageview/index.ts` | Edit | Add country-to-centroid mapping, store lat/lng |
| `src/components/admin/SiteAnalytics.tsx` | Edit | Add world map, advanced metrics (bounce rate, session duration, referrers, peak hours heatmap), restructure layout |

## Technical Details

- The world map uses an equirectangular projection SVG — mapping lat/lng to x/y is trivial: `x = (lng + 180) / 360 * width`, `y = (90 - lat) / 180 * height`
- Country centroids are a static ~60-entry lookup table in the edge function (covers all major countries)
- No external geo-IP APIs needed — we use Cloudflare headers + timezone fallback for country, then centroid mapping for coordinates
- Bounce rate calculation: count sessions with exactly 1 page view vs total unique sessions
- Session duration: difference between max and min `created_at` per `session_id`
- Peak hours heatmap: 7×24 grid colored by page view density
- All new charts use Recharts (already installed)

