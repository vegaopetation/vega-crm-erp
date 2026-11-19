# VEGA CRM 2.0

Phase 1 for VEGA Intertrade & Exhibitions.

## Included
- Premium Exhibition Projects dashboard
- KIF 2026 portfolio record
- Project status, occupancy and staff ownership
- Floorplan-ready halls and booth data model
- USD as the default currency
- Supabase-ready secure data foundation

## Run
```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` before enabling authentication and data access.

For a new database, apply `supabase/schema.sql` first, then apply the SQL files under
`supabase/migrations/`. Existing databases that already have the base schema
only need the migrations. Assign staff roles in `public.profiles` using the
matching Supabase Auth user ID.
