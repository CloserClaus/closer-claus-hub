

# Fix Identified Technical Debt and Potential Problems

## Overview

Address the four issues identified in the previous assessment: (1) complete analytics tracking coverage on untracked pages, (2) refactor CRM.tsx (1487 lines) into smaller components, (3) refactor Dialer.tsx (1180 lines) into smaller components, and (4) add React error boundaries around major features.

---

## 1. Complete Analytics Tracking Coverage

Three pages that use `react-router-dom` but lack `usePageTracking()`:

| Page | Route | Notes |
|------|-------|-------|
| `Auth.tsx` | `/auth` | Public-facing, high traffic |
| `SignContract.tsx` | `/sign/:contractId` | Public-facing (no auth required) |
| `DemoWalkthrough.tsx` | `/example` | Public-facing |

**Change**: Add `import { usePageTracking } from '@/hooks/usePageTracking'` and call `usePageTracking()` inside each component. Since `usePageTracking` requires `useLocation` internally (already uses `react-router-dom`), these pages already have routing context.

---

## 2. Refactor CRM.tsx (1487 lines → ~350 lines)

The CRM page has clear separation points. Extract into these new components:

| New File | Lines Extracted | Responsibility |
|----------|----------------|----------------|
| `src/components/crm/CRMStatsCards.tsx` | ~60 lines | The 4-5 stat cards at the top (Total Leads, Unassigned, Active Deals, Pipeline Value, Closed Won) |
| `src/components/crm/LeadsTab.tsx` | ~180 lines | The entire "leads" TabsContent including search, filters, lead cards grid, pagination |
| `src/components/crm/DealsTab.tsx` | ~120 lines | The "deals" TabsContent with filters, deal rows, pagination |
| `src/components/crm/CRMDialogs.tsx` | ~200 lines | All 8 Dialog/DeleteConfirmDialog components (Lead Form, Deal Form, Dispute, Task, CSV, Delete confirmations, Bulk delete confirmations) |
| `src/hooks/useCRMData.ts` | ~200 lines | Custom hook extracting all state, `fetchData`, `fetchTeamMembers`, filter logic, pagination, bulk actions |

The remaining `CRM.tsx` becomes a thin orchestration layer (~350 lines) that imports these components and the hook, wiring props between them.

---

## 3. Refactor Dialer.tsx (1180 lines → ~300 lines)

| New File | Lines Extracted | Responsibility |
|----------|----------------|----------------|
| `src/components/dialer/DialPad.tsx` | ~200 lines | The dial pad card with caller ID selector, number input, dial buttons, call controls, mute, notes |
| `src/components/dialer/QuickDialList.tsx` | ~120 lines | The "Quick Dial" card with lead search and scrollable lead list |
| `src/components/dialer/CallHistoryPanel.tsx` | ~100 lines | The "Recent Calls" card with call log entries |
| `src/hooks/useDialerState.ts` | ~250 lines | Custom hook extracting state management, fetchCredits, fetchLeads, fetchCallLogs, fetchPhoneNumbers, call handlers (initiate, end, disposition, skip, mute, dial pad press) |

Helper functions like `getCallStatusBadge`, `formatCallDuration`, `getCallStatusDisplay` move into `src/components/dialer/callStatusUtils.ts` (~80 lines).

The remaining `Dialer.tsx` becomes ~300 lines of tab layout and component composition.

---

## 4. Add Error Boundaries

Create a reusable `ErrorBoundary` component and wrap major route-level features.

| File | Action |
|------|--------|
| `src/components/ErrorBoundary.tsx` | Create — React class component with `componentDidCatch`, renders a fallback UI with "Something went wrong" message and a "Try Again" button that resets state |

Wrap in `App.tsx` around the three highest-risk routes:
- CRM route
- Dialer route
- Dashboard route

The error boundary will catch rendering crashes and display a recoverable error screen instead of a white page.

---

## File Change Summary

| File | Action |
|------|--------|
| `src/pages/Auth.tsx` | Edit — add `usePageTracking()` |
| `src/pages/SignContract.tsx` | Edit — add `usePageTracking()` |
| `src/pages/DemoWalkthrough.tsx` | Edit — add `usePageTracking()` |
| `src/hooks/useCRMData.ts` | Create — CRM state + data logic hook |
| `src/components/crm/CRMStatsCards.tsx` | Create — stat cards component |
| `src/components/crm/LeadsTab.tsx` | Create — leads tab component |
| `src/components/crm/DealsTab.tsx` | Create — deals tab component |
| `src/components/crm/CRMDialogs.tsx` | Create — all CRM dialog components |
| `src/pages/CRM.tsx` | Edit — refactor to use extracted components |
| `src/hooks/useDialerState.ts` | Create — dialer state + logic hook |
| `src/components/dialer/DialPad.tsx` | Create — dial pad UI component |
| `src/components/dialer/QuickDialList.tsx` | Create — quick dial lead list |
| `src/components/dialer/CallHistoryPanel.tsx` | Create — call history panel |
| `src/components/dialer/callStatusUtils.ts` | Create — status badge/formatting helpers |
| `src/pages/Dialer.tsx` | Edit — refactor to use extracted components |
| `src/components/ErrorBoundary.tsx` | Create — reusable error boundary |
| `src/App.tsx` | Edit — wrap CRM, Dialer, Dashboard routes with ErrorBoundary |

## Risk Mitigation

- All refactors are purely structural (moving code into new files) with zero behavioral changes
- Props interfaces will be explicitly typed to catch wiring errors at compile time
- No database or edge function changes required
- The error boundary is additive and cannot break existing functionality

