# Kota Designs — Renovation Operating Platform

Kota Designs is a database-first renovation platform for taking a residential project from brief and room survey through design, visualisation, proposal, approval, procurement, site execution and client progress reporting.

## Core workflow

**Client → Project → Spaces → Design → Moodboards → AI Visualisation → Proposal → Approval → Procurement → Purchase Orders → Execution → Progress → Handover**

Legacy MDX project presentations are still supported for backwards compatibility, but Supabase is the source of truth for new projects.

## Main capabilities

- Secure client accounts and project-level access
- Editable room/space surveys and existing-condition notes
- Design concepts, moodboards, materials and BOM inputs
- AI visualisation briefs, generated variants and selected client visuals
- Versioned quotations and client proposal approval
- Procurement lists generated from approved proposal snapshots
- Supplier allocation and purchase orders
- Site tasks, priorities, dates, assignees and status tracking
- Internal vs client-visible execution records
- Client progress timeline and site-photo gallery
- Private Supabase Storage with signed asset URLs
- Audit-style project event records

## Technology

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres and Storage
- Pollinations image generation/editing
- Vercel deployment

## Local setup

Use Node.js 22.12 or newer.


```bash
git clone https://github.com/ogmomanyi/remodel-platform.git
cd remodel-platform
npm install
cp env.example .env.local
npm run dev
```

Required environment variables are documented in `env.example`. Never commit `.env.local` or any live secret.

## Database setup

Apply the SQL migrations in `supabase/migrations` in numerical order. The current application expects migrations through:

- `002_design_studio.sql`
- `003_design_concepts.sql`
- `004_visual_assets.sql`
- `005_moodboards.sql`
- `006_visualisations.sql`
- `007_proposals.sql`
- `008_proposal_approval.sql`
- `009_visualisation_variants.sql`
- `010_procurement.sql`
- `011_visualisation_variant_history.sql`
- `012_purchase_orders.sql`
- `013_project_execution.sql`
- `014_execution_visibility.sql`
- `015_client_data_hardening.sql`
- `016_security_performance_hardening.sql`

The `project-assets` bucket is private. Admin uploads and client signed URLs are generated server-side.

## Production environment

Set these in Vercel for the Production environment:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
POLLINATIONS_API_KEY=
```

Optional:

```env
POLLINATIONS_MODEL=flux
POLLINATIONS_EDIT_MODEL=klein
```

Use a strong, separate `ADMIN_SESSION_SECRET`; the application falls back to `ADMIN_PASSWORD` only for compatibility.

## Validation before release

```bash
npm run lint
npm run build
```

Then verify in Vercel that the deployment for the current `main` commit is successful.

## Security notes

- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` or `POLLINATIONS_API_KEY` to the browser.
- Rotate any secret that has ever been committed to Git history.
- Admin sessions are signed, expiring, HTTP-only cookies.
- Client database access is constrained by Supabase RLS and project membership.
- Progress records can be marked internal so site issues do not automatically appear in the client portal.

## Project structure

```text
src/app/                         Next.js routes and server actions
src/components/admin/            Admin design, procurement and execution UI
src/lib/                         Shared domain logic
src/content/                     Legacy MDX projects/catalog
src/utils/supabase/              Browser/server/admin Supabase clients
supabase/migrations/             Ordered database migrations
```

## Deployment

The canonical app is the repository root and is deployed on Vercel. The nested `remodel-app` directory is not the production root.

## License

Proprietary — Kota Designs.
