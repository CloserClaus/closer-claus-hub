

## Diagnosis

The database has the correct data — all 10 Bizvolve applications have `applicant_name` populated (verified via direct query). The root cause is a **code-level issue** in `JobDetail.tsx`:

1. The query uses `select('*')` but the code accesses the fields via `(app as any).applicant_name` — a fragile pattern that can fail if TypeScript's type narrowing or Supabase's PostgREST response doesn't include these columns as expected.
2. The published site may be running an older version of the code before the `applicant_name` fallback was added.

## Plan

### 1. Fix `JobDetail.tsx` — Use explicit column selection and typed access

- Change the `select('*')` query to explicitly include `applicant_name, applicant_email` in the select string
- Remove `(app as any)` casts — access `app.applicant_name` and `app.applicant_email` directly (these fields already exist in the generated Supabase types)
- Add a hardcoded SDR level (1–2) fallback when profile lookup fails, instead of always defaulting to 1

### 2. Fix `ApplicationsTable.tsx` — Same pattern fix

- Same change: remove `(app as any)` casts, use typed `a.applicant_name` and `a.applicant_email` directly since the types already include them

These are small, surgical changes to two files. Once saved, the preview and published site will correctly display applicant names from the denormalized columns without depending on profile/workspace membership lookups.

