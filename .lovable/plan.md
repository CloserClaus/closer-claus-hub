

## Add "Skip 2-Month Minimum" Toggle to Coupon Creation Form

A simple UI addition to the existing coupon creation dialog and table display.

### Changes

**`src/components/admin/CouponsTable.tsx`**:

1. **Form schema** — Update `couponSchema` to include `skip_two_month_minimum` as an optional boolean (default `false`). Allow `discount_percentage` minimum to be `0` instead of `1` (since a skip-only coupon needs no discount).

2. **Create form** — Add a `Switch` field labeled "Skip 2-Month Minimum" with description: "Allow first-time subscribers to purchase just 1 month instead of the required 2-month minimum."

3. **Insert mutation** — Pass `skip_two_month_minimum` in the `.insert()` call.

4. **Table display** — Add a visual indicator in the Discount column or as a separate badge when `skip_two_month_minimum` is true (e.g., a small "1-Mo" badge next to the discount percentage).

No database or backend changes needed — the `skip_two_month_minimum` column already exists on the `coupons` table from the previous migration.

