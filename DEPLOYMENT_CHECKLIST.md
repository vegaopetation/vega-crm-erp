# VEGA Jewellery Events And Exhibitions — Deployment checklist

## Before deploying
1. Back up the current Supabase database.
2. Confirm `.env` / Vercel environment variables are set: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon/public key only; never use service-role key in browser).
3. Back up the database, then apply `supabase/migrations/0005_security_reconciliation.sql` in Supabase SQL Editor. This reconciles RLS and policy coverage across application tables. Existing installations should not rerun migrations 0001–0004.
4. Deploy this source to a Vercel Preview deployment first.

## Preview smoke test
- Sign in/out and confirm dashboard loads.
- Open Exhibitions, Exhibitors & Companies, Sales Pipeline, Projects and Booth Floorplan.
- Confirm reads and inserts work only for signed-in users with an authorized VEGA profile role.
- Confirm dashboard KPI cards are based on Supabase counts and invoice balances, not hardcoded example figures.
- Confirm the exhibitions activity table only displays real database records.
- Verify role restrictions on finance-related expansion tables.

## Notes
- Visitor Registration & Ticketing was removed from navigation as canceled.
- Hardcoded sample records were removed from module grids.
- Dashboard exhibition rows are blank until the database contains records. Seed/enter Jewellery Arabia, KIF and MIJEX using verified event data; this package does not fabricate dates, venues, or metrics.
- A full Next.js build could not be completed in this environment because dependency installation timed out. Treat Vercel Preview build and smoke test as required before production promotion.
