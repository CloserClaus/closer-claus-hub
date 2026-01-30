

# Comprehensive Platform Enhancement Plan

## Overview
This plan addresses 7 major feature areas across the platform: CRM bulk operations, Scripts editor fix, Dialer troubleshooting, Contracts placeholder, Purchase pricing changes, Refer and Earn program, and Admin Panel enhancements.

---

## 1. CRM Bulk Operations

### 1.1 Bulk Convert Leads to Deals
**Current State:** Users must drag-and-drop each lead individually to convert it to a deal.

**Implementation:**
- Add a "Convert to Deals" button to the `BulkActionsBar.tsx` component
- Create a modal dialog allowing users to set default deal values (title prefix, default value, default stage)
- Implement `handleBulkConvertToDeals()` function that:
  - Iterates through selected leads
  - Creates a deal for each lead with proper `lead_id` linking
  - Assigns deals to the same user as the lead (or workspace owner)
  - Provides success/failure summary

**Files to modify:**
- `src/components/crm/BulkActionsBar.tsx` - Add convert button and dialog
- `src/pages/CRM.tsx` - Add handler function and state

### 1.2 Advanced Bulk Lead Assignment
**Current State:** Basic SDR dropdown exists but lacks quantity and tag-based assignment.

**Implementation:**
- Create new `BulkAssignDialog.tsx` component with:
  - SDR selection dropdown (existing team members)
  - Number input field for lead quantity
  - Tag filter dropdown (hot/warm/cool/cold based on `readiness_segment`)
  - Logic to enable/disable tag dropdown based on whether leads have tags
- Add database column for lead tags if not using existing `readiness_segment`
- Assignment logic:
  - If tag specified: assign from that tag only
  - If no tag specified but leads are tagged: distribute equally across tags
  - Respect the quantity limit specified

**Files to modify:**
- `src/components/crm/BulkAssignDialog.tsx` (new)
- `src/components/crm/BulkActionsBar.tsx` - Add assignment dialog trigger
- `src/pages/CRM.tsx` - Add handler for advanced assignment

### 1.3 Lead Deduplication
**Current State:** Basic email/phone duplicate check exists in `LeadForm.tsx` but no bulk deduplication.

**Implementation:**
- Create `DedupeLeadsDialog.tsx` component with:
  - "Find Duplicates" button that triggers analysis
  - Smart matching algorithm using:
    - Exact email match
    - Exact phone match
    - Normalized LinkedIn URL match
    - Fuzzy name matching (Levenshtein distance < 3)
    - Domain extraction from email matching
  - Results displayed in a review list showing:
    - Original lead vs duplicate lead side-by-side
    - Match confidence score and match type
    - Actions: Keep Both / Delete Duplicate / Merge
- Tag duplicates with `is_potential_duplicate: true` for user review

**Files to modify:**
- `src/components/crm/DedupeLeadsDialog.tsx` (new)
- `src/pages/CRM.tsx` - Add dedupe button and dialog

**Deduplication Algorithm:**
```text
1. Normalize all LinkedIn URLs (existing function)
2. Extract domains from emails
3. For each lead pair in workspace:
   - Score 100: exact email match
   - Score 100: exact phone match  
   - Score 90: exact LinkedIn URL match
   - Score 70: same first name + same domain
   - Score 60: fuzzy name match + same company
4. Flag pairs with score >= 60 as potential duplicates
```

---

## 2. Scripts - Placeholder Insertion Fix

### Current Issue
In `CallScriptManager.tsx`, the `insertPlaceholder()` function appends to the end instead of cursor position.

### Solution
- Get textarea element reference using `useRef`
- Track cursor position with `selectionStart`
- Modify `insertPlaceholder()` to:
  - Get current cursor position from textarea ref
  - Insert placeholder at cursor position
  - Restore focus and update cursor position after insertion

**Files to modify:**
- `src/components/dialer/CallScriptManager.tsx`

---

## 3. Dialer Issues

### 3.1 Edge Function Non-2xx Error
**Diagnosis:** The Twilio edge function appears to be working based on network logs showing 200 responses.

**Investigation Steps:**
- Check for specific error scenarios in call initiation
- Verify TWILIO_TWIML_APP_SID is correctly configured
- Add better error handling and logging

### 3.2 Token Expiration Error ("Twilio was unable to validate...")
**Current State:** The `useTwilioDevice.ts` hook already has:
- `tokenWillExpire` event handler
- Proactive token refresh every 45 minutes
- Page visibility change handler
- Error code 20104 (token expired) auto-recovery

**Enhancements:**
- Add more aggressive token refresh (every 30 minutes instead of 45)
- Implement connection health check ping every 5 minutes
- Add visible "Reconnecting..." status when token refresh occurs
- Store last token refresh timestamp and force refresh if > 55 minutes

**Files to modify:**
- `src/hooks/useTwilioDevice.ts` - Enhanced token management
- `src/components/dialer/PowerDialer.tsx` - Add connection status indicator

---

## 4. Contracts Placeholder Text

### Implementation
Add informational placeholder when no deals are available in proposal stage.

**Files to modify:**
- `src/pages/Contracts.tsx` - Add empty state message

**Message:**
> "Contracts can only be created for deals in the Proposal stage. If you can't find your deal here, make sure it's in the Proposal stage inside the CRM."

---

## 5. Purchase Pricing Changes

### Current vs New Pricing

| Item | Current | New |
|------|---------|-----|
| Starter (100 min) | $2 | $4 |
| Growth (500 min) | $10 | $20 |
| Pro (1000 min) | $20 | $40 |
| Enterprise | 5000 min / $100 | 6000 min / $200 |
| Call Transcription | $0.029/min | $199 flat |
| Answering Machine Detection | $0.009/call | $99 flat |
| Voice Insights | $0.003/min | **REMOVED** |
| Local Phone Number | $1.40/mo | $2.80/mo |

**Files to modify:**
- `src/components/dialer/PurchaseTab.tsx` - Update pricing arrays
- `supabase/functions/twilio/index.ts` - Update `monthly_cost` for numbers
- `supabase/functions/purchase-dialer-credits/index.ts` - Update Stripe pricing

---

## 6. Refer and Earn Program

### Database Schema
New tables required:

```text
referrals
├── id (uuid, PK)
├── referrer_id (uuid, FK -> profiles)
├── referred_user_id (uuid, FK -> profiles, nullable)
├── referral_code (text, unique)
├── status (enum: pending, completed, expired)
├── credits_awarded (integer, default 0)
├── created_at (timestamp)
└── completed_at (timestamp, nullable)
```

### Implementation

**1. Create Referral Code System:**
- Generate unique codes per user (format: `CC-{user_initials}-{random6}`)
- Store in `profiles.referral_code` or separate `referrals` table

**2. Refer and Earn Page (`src/pages/ReferAndEarn.tsx`):**
- Display user's unique referral link
- Copy-to-clipboard button
- Referral stats: sent, pending, completed, credits earned
- List of referrals with status

**3. Auth Page Integration:**
- Accept `?ref={code}` query parameter
- Store referral code in signup metadata
- Track referrer on successful agency signup

**4. Backend Logic (`supabase/functions/process-referral/index.ts`):**
- Trigger on new agency workspace creation
- Award 500 lead credits to referrer
- Update referral status to completed

**5. Admin Panel Section:**
- New "Referrals" tab showing all referrals
- Columns: Referrer, Referred Agency, Status, Credits Awarded, Date

**Files to create/modify:**
- `src/pages/ReferAndEarn.tsx` (new)
- `src/pages/Auth.tsx` - Add referral code capture
- `src/components/layout/AppSidebar.tsx` - Add nav item above Settings
- `src/components/admin/ReferralsTable.tsx` (new)
- `src/pages/AdminDashboard.tsx` - Add referrals tab
- `supabase/functions/process-referral/index.ts` (new)
- Database migration for referrals table

---

## 7. Admin Panel Enhancements

### 7.1 Phone Numbers Management
New section: "Active Numbers"

**Features:**
- List all active phone numbers across all workspaces
- Columns: Number, Workspace, Assigned SDR, Purchased Date, Monthly Cost
- Admin actions: Terminate number (releases from Twilio, marks inactive)
- When terminated, workspace's free number count is recalculated

**Files to create:**
- `src/components/admin/PhoneNumbersTable.tsx`

### 7.2 Purchases Tracking (Collapsible Categories)

**Structure:**
```text
Purchases
├── Lead Credit Purchases
│   └── (existing lead_credit_purchases table)
├── Dialer Purchases  
│   └── (existing credit_purchases table for minutes)
└── Subscription Purchases
    └── (from workspaces.subscription_tier history)
```

**Files to create:**
- `src/components/admin/PurchasesSection.tsx` - Collapsible container
- `src/components/admin/LeadCreditPurchasesTable.tsx`
- `src/components/admin/DialerPurchasesTable.tsx`
- `src/components/admin/SubscriptionPurchasesTable.tsx`

### 7.3 Commissions Tracking
Move existing `PayoutsTable` or enhance for commission visibility.

### 7.4 Missing Data Audit
Items currently not tracked that should be added:
- Phone number purchases (separate from minutes)
- Feature addon purchases (transcription, AMD)
- Referral activity
- Login/activity logs (optional)

**Updated Admin Sidebar Structure:**
```text
Platform Admin
├── Overview
├── Users
│   ├── Agencies
│   ├── SDRs
├── Activity
│   ├── Jobs
│   ├── Applications
│   ├── Leads
│   ├── Deals
│   ├── Contracts
│   ├── Calls
│   ├── Phone Numbers (NEW)
├── Marketplace
│   ├── Master Leads
│   ├── Apollo Leads
├── Finance
│   ├── Commissions
│   ├── Payouts
│   ├── Salaries
│   ├── Purchases (NEW - collapsible)
├── Referrals (NEW)
├── Support
│   ├── Support Tickets
│   ├── Bug Reports
│   ├── Feature Requests
├── Settings
│   ├── Coupons
│   ├── Admin Controls
```

---

## Technical Considerations

### Database Migrations Required
1. `referrals` table for referral program
2. Add `profiles.referral_code` column
3. Potentially `phone_number_purchases` table for tracking

### Edge Functions to Create/Modify
1. `process-referral` - Handle referral completion and credit award
2. `twilio/index.ts` - Update number pricing
3. `purchase-dialer-credits/index.ts` - Update package pricing

### Security Considerations
- RLS policies for referrals table (users see only their own)
- Admin-only access for phone number termination
- Rate limiting on referral code generation

---

## Implementation Priority

1. **High Priority (Immediate Impact):**
   - Dialer token refresh improvements
   - Contracts placeholder text
   - Purchase pricing updates

2. **Medium Priority (Feature Enhancement):**
   - CRM bulk operations (convert, assign, dedupe)
   - Scripts placeholder fix
   - Admin phone numbers table

3. **Lower Priority (New Feature):**
   - Refer and Earn program
   - Comprehensive admin purchase tracking

---

## Estimated Effort

| Feature Area | Components | Estimated Changes |
|--------------|------------|-------------------|
| CRM Bulk Operations | 4 components | Medium |
| Scripts Fix | 1 component | Small |
| Dialer Fixes | 2 components | Small |
| Contracts | 1 page | Small |
| Purchase Pricing | 3 files | Small |
| Refer and Earn | 5+ files + migration | Large |
| Admin Panel | 5+ components | Medium-Large |

