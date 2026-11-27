# SpazaLink

South African neighbourhood marketplace pilot, starting in Thohoyandou, Limpopo.

## Current pilot mode

SpazaLink is configured for a **supervised cash-only, collection-only pilot**.

- Buyers can place collection orders and pay cash when they collect.
- Sellers confirm the order workflow and record collection/cash confirmation.
- Online Paystack checkout is paused. Do not enable it by adding a key or changing a frontend setting; the pilot database also blocks the online-order RPC permissions.
- Seller delivery is disabled for the pilot.
- The platform fee is **0% during the pilot**. Existing order records retain their recorded fee; new pilot shop settings are constrained to 0%.
- Password-reset pages and server actions are present, but the real email inbox flow still needs testing.
- WhatsApp integration code exists, but live message delivery has not been proven. Until it is tested, a named person must watch orders and phone sellers.

This is not approval for an open public launch. Complete the product, hosting, security, legal and field-test gates in `docs/pilot-mode-and-revenue-plan.md` before inviting real users.

## Monorepo structure

- `frontend/` — Next.js App Router PWA.
- `backend/` — Fastify TypeScript API. The current deployment uses Render.
- `supabase/migrations/` — timestamped Supabase CLI migrations, including `20261126180323_pilot_cash_collection_zero_fee.sql`.

The initial database schema SQL is still missing from GitHub. The repository alone therefore cannot rebuild a clean database from scratch. Do not treat the migration folder as a complete disaster-recovery backup until the baseline schema and restore procedure are committed and tested.

## Local development

Requires Node.js 22+ and npm.

```sh
npm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm run dev
```

Run the API separately with `npm run dev:api`.

## Frontend and API deployment

The frontend is configured for **Vercel** with Root Directory `frontend`. The Fastify API uses the root `render.yaml` blueprint or `backend/Dockerfile`.

Required frontend environment variables include:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`

The API uses the Supabase publishable key and forwards authenticated callers' access tokens so database Row Level Security remains in force. Never place a Supabase service-role key in the browser or public API.

**Hosting warning:** Vercel Hobby is limited to personal/non-commercial use. Render Free services sleep after inactivity and are not intended for production. Keep these free deployments for development or supervised rehearsals only; confirm an eligible hosting arrangement before a real commercial pilot.

## Marketplace and cash orders

The buyer flow includes product search, area/category filters, a persistent single-seller cart, collection checkout and buyer order history. The server action enforces collection-only checkout. Cash orders use the `create_cash_order` PostgreSQL RPC, which checks the authenticated buyer, shop and fulfilment status, locks product rows, checks stock, and writes order items, stock movements and notifications in one transaction.

Checkout records cash due; it does not mark an order paid. The seller records collection and cash received through the order workflow. The pilot's 0% fee setting is enforced at the database level.

## Payments and revenue

**Paystack is the selected provider for a later online-payment phase.** Its checkout and signed-webhook code remain in the repository, but online checkout is disabled in the pilot. No real or test Paystack payment has been confirmed for this pilot. Seller split payouts, refunds, abandoned-payment stock release and the required written legal/provider checks remain outstanding.

The agreed pilot revenue approach is:
- Pilot: 0% platform fee while sellers and buyers test the service.
- After the pilot: proposed 10% commission on completed orders only, subject to the pilot decision and seller agreement.
- Until automated split settlements are built and approved, sellers receive cash directly and the platform would collect commission manually by weekly statement and EFT.

See `docs/pilot-mode-and-revenue-plan.md` for the worked revenue example and conditions.

## Verification status

The code checks passed on the PR #17 pilot-mode change: 55 automated tests, TypeScript checks, lint and production builds. These checks do not prove the full deployed experience. The following still require real-world verification:
- Password-reset confirmation and reset emails in real inboxes.
- RLS access with separate buyer and seller accounts.
- Two buyers competing for the final unit of stock.
- Full order lifecycle on different phones and slow mobile data.
- WhatsApp delivery and seller alert timing.
- Backup and restore into a separate Supabase test project.
- Unauthenticated access to the deployed site on a phone.

## Security controls

- **Headers:** CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` are configured in `frontend/next.config.ts`. The CSP still permits inline scripts; a nonce-based policy remains future work.
- **Uploads:** file signatures are checked. Shop and product photos are resized to WebP and stripped of metadata; verification PDFs download rather than opening inline.
- **Redirects and sign-in:** redirects are restricted to local paths, and sign-in/sign-up errors are generic.
- **API:** proxy hops are limited by `TRUST_PROXY_HOPS`; outbound Paystack and WhatsApp calls have timeouts.
- **Database:** Row Level Security is enabled on the application's public tables. Continue testing policies with separate real accounts; automated code checks are not a substitute for RLS verification.
- **Dependencies:** CI runs `npm audit --omit=dev --audit-level=high`; Dependabot proposes weekly updates.

## Key project documents

- [Pilot mode and revenue plan](docs/pilot-mode-and-revenue-plan.md)
- [Paystack implementation notes](docs/phase-f-paystack.md)
