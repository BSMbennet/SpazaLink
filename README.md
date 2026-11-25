# SpazaLink

South African neighbourhood marketplace pilot, starting in Thohoyandou, Limpopo.

## Monorepo structure

- `frontend/` — Next.js App Router PWA. Configure Vercel **Root Directory** as `frontend`.
- `backend/` — Fastify TypeScript API. Deploy to Render from `backend/Dockerfile` or use the root `render.yaml` blueprint.
- `supabase/migrations/` — timestamped Supabase CLI migrations. The applied migration history is `20261125221630`, `20261125221748`, `20261125221941`, `20261125222006`, and `20261125225211`. Migrations 002–005 are mirrored here; the initial schema SQL (001) is still missing from GitHub, so a clean database restore from this repository is not yet possible.

## Local development

Requires Node.js 22+ and npm.

```sh
npm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm run dev
```

Run the API separately with `npm run dev:api`.

## Vercel frontend

Import `BSMbennet/SpazaLink`, set Root Directory to `frontend`, and configure:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL` (the deployed Vercel origin, used in email confirmation redirects)
- `NEXT_PUBLIC_API_URL`

Build command: `npm run build`.

## Render backend

Use `render.yaml` or create a Docker web service with:
- Docker context: `backend`
- Dockerfile: `backend/Dockerfile`
- Health check: `/health`
- Environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FRONTEND_ORIGIN`

The API uses the Supabase publishable/anon key and forwards authenticated callers' access tokens so database Row Level Security remains in force. Never place a service-role key in the browser or public API.

## Marketplace and cash orders

The buyer flow now includes product search, area/category filters, a persistent single-seller cart, collection or seller delivery selection, buyer order history, and cash checkout. Cash orders use the `create_cash_order` PostgreSQL RPC, which checks the authenticated buyer, shop and fulfilment status, locks product rows, checks stock, calculates the 10% seller platform fee, and writes order items, stock movements and notifications in one transaction. The order is recorded as `cash_due`; it is never marked paid by checkout.

## Payments and WhatsApp

A payment provider has not yet been approved for implementation. Paystack was suggested for consideration, but payment code remains intentionally absent until confirmed. WhatsApp Cloud API remains a Phase 2 feature.

## Verification status

GitHub Actions run 38 passed dependency installation, all 13 automated tests (5 frontend domain tests and 8 backend/API contract tests), TypeScript checks for both workspaces, ESLint, the Next.js production build, and the backend TypeScript build on commit `ffe0b3b`. This verifies compilation and automated checks, not authenticated live checkout or deployed Render/Vercel services. No lockfile is committed yet. The initial schema SQL file is still missing from GitHub, so a fresh database restore from this repository remains incomplete.

The Supabase security advisor reports one intentional warning for the authenticated `SECURITY DEFINER` cash-order RPC. It is not executable by `anon`, checks `auth.uid()` and buyer role, and performs the protected multi-table transaction. The performance advisor also reports 20 unindexed foreign keys and two overlapping permissive read-policy pairs; these should be optimized before pilot traffic. Unused-index notices are expected while the tables are empty.
