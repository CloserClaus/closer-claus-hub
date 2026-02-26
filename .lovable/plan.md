

# Sidebar Reorganization — Labeled Sections, Flow-Ordered

## Current Problem
16 flat items in the agency sidebar, no visual grouping, no indication of workflow progression.

## New Structure

Based on the user's feedback: no merges, Leads before CRM, Conversations in Operations, Dialer and Email stay separate.

### Agency Owner Sidebar

```text
┌─────────────────────┐
│  [Logo]             │
│  [Workspace]        │
├─────────────────────┤
│  SETUP              │
│  Dashboard          │
│  Offer Diagnostic   │
│  Script Builder     │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  HIRING             │
│  Jobs               │
│  Team               │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  SALES              │
│  Leads              │  ← before CRM
│  CRM                │
│  Dialer             │
│  Email              │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  OPERATIONS         │
│  Trainings          │
│  Contracts          │
│  Commissions        │
│  Conversations      │  ← moved here
├─────────────────────┤
│  (pinned bottom)    │
│  Subscription       │
│  Billing            │
│  Refer & Earn       │
│  Settings           │
│  [User avatar]      │
└─────────────────────┘
```

### SDR Sidebar

```text
┌─────────────────────┐
│  [Logo]             │
│  [Workspace]        │
│  [Level Progress]   │
├─────────────────────┤
│  HOME               │
│  Dashboard          │
│  Find Jobs          │
│  My Companies       │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  SALES              │
│  Leads              │  ← before CRM
│  CRM                │
│  Dialer             │
│  Email              │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  OPERATIONS         │
│  Trainings          │
│  Contracts          │
│  My Earnings        │
│  Conversations      │  ← moved here
├─────────────────────┤
│  Settings           │
│  [User avatar]      │
└─────────────────────┘
```

## Implementation

Only one file changes: `src/components/layout/AppSidebar.tsx`.

### Changes

1. **Replace flat `agencyOwnerNav` array** with a section-based structure:
   - Define a `NavSection` type: `{ label: string; items: NavItem[] }`
   - Create `agencyOwnerSections` with 4 groups: SETUP, HIRING, SALES, OPERATIONS
   - Create a separate `agencyOwnerFooterNav` array for Subscription, Billing, Refer & Earn
   - Reorder: Leads before CRM, Conversations moved to OPERATIONS

2. **Replace flat `sdrNav` array** with sections:
   - HOME, SALES, OPERATIONS
   - Same reordering: Leads before CRM, Conversations in OPERATIONS

3. **Update the render logic** to iterate over sections instead of a flat array:
   - Each section renders as a `SidebarGroup` with a `SidebarGroupLabel`
   - A `SidebarSeparator` between each section
   - Footer nav items (Subscription, Billing, Refer & Earn) render in the `mt-auto` group alongside Settings
   - When collapsed, section labels get `sr-only` class (already the pattern used)

4. **Platform admin nav** stays unchanged (it's a different layout).

### No routing, page, or database changes needed.

