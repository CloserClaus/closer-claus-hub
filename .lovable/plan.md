

# Mobile-Friendliness Overhaul

## Issues Found

### 1. Help Widget ('?') Overlaps Bottom Navigation
The `HelpWidget` component uses `fixed bottom-4 right-4 z-50`, placing it directly on top of the mobile bottom navigation bar. On mobile, users see the blue '?' circle sitting on the "More" button area, blocking interaction.

### 2. Missing Navigation Items in Mobile Bottom Nav
The mobile "More" sheet is missing several pages that exist in the desktop sidebar:
- **Offer Diagnostic** (`/app/offer-diagnostic`)
- **Script Builder** (`/app/script-builder`)
- **Leads** (`/leads`)
- **Refer and Earn** (`/refer`)

SDR mobile nav is also missing **Leads** (`/leads`) and **Contracts** (`/contracts`).

### 3. Dialer Tab Bar Overflows on Mobile
The `TabsList` on the Dialer page contains 5-6 tabs (Manual Dialer, Power Dialer, Purchase, Scripts, Recordings, Settings) that extend beyond the screen width. Tabs like "Purchase" get cut off ("Purcha...") with no way to scroll to hidden tabs.

### 4. Dialer Page Layout Issues
- The header row (`flex items-center justify-between`) stacks poorly -- the title and CreditsDisplay fight for horizontal space.
- The main content uses `p-6` with no mobile reduction, wasting space.
- The 3-column grid (`grid-cols-1 lg:grid-cols-3`) is fine structurally but the cards within it are quite tall on mobile.

### 5. Inconsistent Page Padding Across App
Many pages use `p-6` without mobile-specific padding (should be `p-4 md:p-6` or `p-3 md:p-6`).

---

## Implementation Plan

### Task 1: Fix HelpWidget Position on Mobile
**File:** `src/components/help/HelpWidget.tsx`
- Change the container from `fixed bottom-4 right-4` to `fixed bottom-20 right-4 md:bottom-4` so it sits above the mobile bottom nav (which is ~64px tall).
- This ensures the '?' button is always accessible and never overlaps navigation.

### Task 2: Add Missing Nav Items to Mobile Bottom Nav
**File:** `src/components/layout/MobileBottomNav.tsx`
- Add missing items to `agencyOwnerMore` array:
  - Offer Diagnostic (`/app/offer-diagnostic`) with ClipboardCheck icon
  - Script Builder (`/app/script-builder`) with ScrollText icon
  - Leads (`/leads`) with Search icon
  - Refer and Earn (`/refer`) with Gift icon
- Add missing items to `sdrMore` array:
  - Leads (`/leads`) with Search icon
  - Contracts (`/contracts`) with FileSignature icon
- Import the new icons (ClipboardCheck, ScrollText, Search, Gift, FileSignature).

### Task 3: Fix Dialer Tab Bar Overflow
**File:** `src/pages/Dialer.tsx`
- Wrap the `TabsList` with horizontal scroll support on mobile by adding `overflow-x-auto` and `flex-nowrap` classes, plus hiding the scrollbar for a clean appearance.
- Ensure all tab triggers use `whitespace-nowrap` so text does not wrap.

### Task 4: Fix Dialer Header and Padding
**File:** `src/pages/Dialer.tsx`
- Change `<main className="flex-1 p-6">` to `<main className="flex-1 p-3 md:p-6">`.
- Change the header row from `flex items-center justify-between` to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2` so the title and credits stack vertically on mobile.
- Reduce the title from `text-3xl` to `text-xl md:text-3xl`.

### Task 5: Audit and Fix Padding on Other Key Pages
Apply `p-3 md:p-6` or `p-4 md:p-6` pattern to these pages:
- `src/pages/Commissions.tsx` (4 instances of `p-6`)
- `src/pages/Billing.tsx`
- `src/pages/Jobs.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Contracts.tsx`
- `src/pages/Conversations.tsx`
- `src/pages/TeamManagement.tsx`
- `src/pages/Training.tsx`
- `src/pages/Leads.tsx`
- `src/pages/ScriptBuilder.tsx`
- `src/pages/OfferDiagnostic.tsx`
- `src/pages/ReferAndEarn.tsx`

Each page's `<main>` tag will be updated from `p-6` to `p-3 md:p-6`.

### Task 6: Fix Dialer TabsList Scrollbar Styling
**File:** `src/index.css`
- Add a utility class for hiding scrollbars on the tab bar while keeping scroll functionality, using `-webkit-scrollbar` and `scrollbar-width: none`.

---

## Summary of Changes

| Area | Issue | Fix |
|------|-------|-----|
| HelpWidget | Overlaps bottom nav on mobile | Move up with `bottom-20 md:bottom-4` |
| Mobile Nav | Missing 4+ pages in "More" menu | Add all sidebar items to mobile nav arrays |
| Dialer Tabs | Tabs overflow and get cut off | Add horizontal scroll to TabsList |
| Dialer Layout | Header cramps, excess padding | Stack header, reduce padding on mobile |
| All Pages | `p-6` wastes space on mobile | Switch to `p-3 md:p-6` responsive padding |

