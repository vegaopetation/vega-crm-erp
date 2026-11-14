# VEGA CRM & ERP — Expanded Application Workspace

This ZIP is the latest available VEGA-branded Next.js/Supabase application workspace from the current build series. It includes the dashboard/navigation and database schema migrations for the broad exhibition CRM/ERP scope.

## Windows local setup
1. Install Node.js 20 LTS: https://nodejs.org/
2. Extract this folder and open `vega-cloud-app`.
3. Double-click `install_windows.bat`.
4. Create a Supabase project at https://supabase.com/ (free tier can be used for development).
5. Copy the Project URL and anon/public key from Supabase into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
6. In Supabase SQL Editor, run the migrations in order:
   - `supabase/migrations/0001_vega_schema.sql`
   - `supabase/migrations/0002_expansion_modules.sql`
   - `supabase/migrations/0003_advanced_business_ai_integrations.sql`
7. Start with `npm run dev`; browse to http://localhost:3000.

## Deployment
Deployment target is Vercel for the Next.js front end with Supabase PostgreSQL/Auth/Storage. Use `.env.example` as the environment variable reference. Never place a Supabase service-role key in a public/browser environment variable.

## Included workspace scope
The app contains VEGA branding, grouped dashboard/module navigation, basic exhibition/CRM screens, booth grid/status UI, CSV export, and SQL schema foundations for companies/exhibitors, booth bookings, finance/accounting, operations, procurement, inventory/assets, documents/contracts, HR, communications, portal workflows, visitor/ticketing, analytics, compliance, franchise/branch, pricing, networking, AI insight domains, and integrations.

## Critical implementation status (honest)
This is **not yet a complete production-ready CRM/ERP**. Many module views are scaffolded and use sample or browser-session data; complete persistent CRUD for every module, full geometry-based draggable floorplan with background upload/layers, validated financial ledger and posting rules, PDF/receipt generation, secure role-specific policies, provider integrations (WhatsApp/email/payments), real AI calls, scheduled automation, end-to-end testing, and security review remain to be implemented. The schema is a foundation, not proof of finished business logic. Do not store real passport, visa, payment, or confidential exhibitor data until the missing controls and workflows are finished and reviewed.

## Credentials
Supabase credentials are user-specific and intentionally not included. The app does not ship with a production admin username/password. Configure Supabase Auth and create an admin account in your own project.

## Oracle Cloud deployment
See `ORACLE_DEPLOY.md`; Docker deployment files (`Dockerfile`, `docker-compose.yml`, `.dockerignore`, `oracle-install.sh`) are included.
