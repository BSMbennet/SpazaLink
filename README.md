# SpazaLink

South African neighbourhood marketplace pilot, starting in Thohoyandou, Limpopo.

## Monorepo structure

- `frontend/` — Next.js App Router PWA. Configure Vercel **Root Directory** as `frontend`.
- `backend/` — Fastify TypeScript API. Deploy to Render from `backend/Dockerfile` or use the root `render.yaml` blueprint.
- `supabase/migrations/` — database migrations. Migrations 002–004 are mirrored here; migration 001 (the initial schema) is included in the complete project bundle but still needs to be committed here before this repository alone can restore a fresh database.

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
- `NEXT_PUBLIC_API_URL`

Build command: `npm run build`.

## Render backend

Use `render.yaml` or create a Docker web service with:
- Docker context: `backend`
- Dockerfile: `backend/Dockerfile`
- Health check: `/health`
- Environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FRONTEND_ORIGIN`

The API uses the Supabase publishable/anon key and forwards authenticated callers' access tokens so database Row Level Security remains in force. Never place a service-role key in the browser or public API.

## Payments and WhatsApp

A payment provider has not yet been approved for implementation. Paystack was suggested for consideration, but payment code remains intentionally absent until confirmed. WhatsApp Cloud API remains a Phase 2 feature.

## Verification status

The existing five domain-rule tests passed in the local foundation package. The full monorepo install, type checks, lint, production builds, and live deployment still need to be run with npm registry access and deployment environment variables. Do not treat deployment configuration as proof of a live deployment.
