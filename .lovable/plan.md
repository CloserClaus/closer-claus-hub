

## Subscription Billing Overhaul

This plan covers 6 interconnected changes: a "skip 2-month minimum" coupon type, proper Stripe recurring billing, failed payment grace period with account restriction, subscription confirmation/renewal emails, and admin-assigned subscription handling.

### Current State

- First-time monthly subscribers are charged 2 months upfront via a one-time add-on invoice item on top of the Stripe recurring subscription
- Stripe handles recurring billing natively (the subscription itself is monthly recurring)
- `invoice.payment_failed` webhook sets status to `past_due` and notifies, but never restricts the account
- No subscription confirmation or renewal emails are sent (only in-app notifications)
- Admin can assign subscriptions directly via `AgenciesTable` but doesn't set `first_subscription_at` or anchor dates

### Changes

---

#### 1. Database Migration

Add to `workspaces`:
- `subscription_due_date` (timestamptz, nullable) — tracks when the next payment is due
- `grace_period_end` (timestamptz, nullable) — 7 days after a failed payment; account gets restricted after this

These fields let the SubscriptionGuard and the cron job know when to lock an account.

---

#### 2. Coupon Type: Skip 2-Month Minimum

Add a `skip_two_month_minimum` boolean column to the `coupons` table (default false). When this flag is true on a validated coupon, the `create-subscription` edge function will NOT add the extra month invoice item, even for first-time subscribers.

This is separate from the discount percentage — a coupon can have `discount_percentage: 0` and `skip_two_month_minimum: true` to simply waive the 2-month requirement without any price discount.

**create-subscription changes:**
- Read `skip_two_month_minimum` from the validated coupon
- Pass it into the `shouldChargeTwoMonths` logic: `const shouldChargeTwoMonths = !hasHadSubscriptionBefore && billing_period === 'monthly' && !skipTwoMonthMinimum`
- Pass the flag in checkout metadata so the webhook can set the correct `subscription_due_date`

**Subscription.tsx changes:**
- When a coupon with `skip_two_month_minimum` is applied, show pricing as `$X/mo` instead of `$X*2 for 2 months`

---

#### 3. Subscription Due Date Tracking

**stripe-webhook `checkout.session.completed`:**
- For first-time 2-month subscribers: set `subscription_due_date` = now + 2 months
- For 1-month (coupon skip or returning): set `subscription_due_date` = now + 1 month
- For yearly: set `subscription_due_date` = now + 1 year

**stripe-webhook `invoice.payment_succeeded` (renewal):**
- Update `subscription_due_date` = now + 1 month (or 1 year for yearly)
- Clear `grace_period_end` if it was set

This is tracked locally for display/guard purposes. Stripe handles the actual recurring charge.

---

#### 4. Failed Payment → 7-Day Grace Period → Account Restriction

**stripe-webhook `invoice.payment_failed`:**
- Set `subscription_status = 'past_due'`
- Set `grace_period_end = now + 7 days`
- Send in-app notification (already exists)
- Send email via Resend: "Your payment failed. Update your payment method within 7 days or your account will be restricted."

**New edge function: `check-subscription-grace`** (cron, daily):
- Query workspaces where `grace_period_end <= now()` AND `subscription_status = 'past_due'`
- For each: set `subscription_status = 'cancelled'`, `is_locked = true`
- Send notification + email: "Your account has been restricted due to non-payment."

**SubscriptionGuard update:**
- Also check for `past_due` status — show a warning banner (not blocking) with "Payment failed — update your card by [date]"
- When `subscription_status = 'cancelled'` due to grace expiry, the existing blocking dialog kicks in

---

#### 5. Subscription Confirmation & Renewal Emails

**New edge function: `send-subscription-email`:**
- Uses Resend to send HTML emails for:
  - `purchase`: "Welcome! Your [Tier] plan is now active."
  - `renewal`: "Your [Tier] plan has been renewed for another month."
  - `payment_failed`: "Payment failed — update your card within 7 days."
  - `account_restricted`: "Your account has been restricted due to non-payment."

**Trigger points in stripe-webhook:**
- `checkout.session.completed` (subscription) → send `purchase` email
- `invoice.payment_succeeded` with `billing_reason: subscription_cycle` → send `renewal` email
- `invoice.payment_failed` → send `payment_failed` email

---

#### 6. Admin-Assigned Subscriptions

Update `AgenciesTable.handleAssignSubscription` to also set:
- `first_subscription_at` (if not already set)
- `subscription_due_date = now + 1 month`
- `subscription_anchor_day = current day of month`

This means admin-assigned subscriptions are treated as 1-month grants. When `subscription_due_date` passes without a Stripe renewal (since there's no Stripe subscription), the grace period logic kicks in and the user is prompted to purchase their own subscription.

Also update the `SubscriptionGuard` and `useWorkspace` to fetch `subscription_due_date` and `grace_period_end` for the warning banner.

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `subscription_due_date`, `grace_period_end` to workspaces; add `skip_two_month_minimum` to coupons |
| `supabase/functions/create-subscription/index.ts` | Read `skip_two_month_minimum` from coupon, skip extra month charge when true |
| `supabase/functions/stripe-webhook/index.ts` | Set due dates on checkout + renewal; set grace period on failure; send emails |
| `supabase/functions/send-subscription-email/index.ts` | New — sends purchase/renewal/failed/restricted emails via Resend |
| `supabase/functions/check-subscription-grace/index.ts` | New — daily cron to restrict accounts past grace period |
| `supabase/config.toml` | Add new function configs |
| `src/pages/Subscription.tsx` | Show 1-month pricing when skip coupon applied |
| `src/components/admin/AgenciesTable.tsx` | Set due date + anchor on admin assignment |
| `src/components/layout/SubscriptionGuard.tsx` | Add past_due warning banner |
| `src/hooks/useWorkspace.tsx` | Fetch `subscription_due_date`, `grace_period_end` |

### Implementation Order

1. Database migration (new columns)
2. `send-subscription-email` edge function
3. `check-subscription-grace` edge function + cron setup
4. Update `create-subscription` for skip coupon logic
5. Update `stripe-webhook` for due dates, grace periods, and emails
6. Update `Subscription.tsx` pricing display
7. Update `AgenciesTable` admin assignment
8. Update `SubscriptionGuard` + `useWorkspace` for grace period UI

