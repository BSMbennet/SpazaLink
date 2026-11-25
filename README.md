# SpazaLink

Neighbourhood marketplace for small sellers in South Africa. Initial pilot: Thohoyandou, Limpopo.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Row Level Security and Storage
- Vercel deployment target

## Phase 1 foundation

- Supabase project created in São Paulo (`sa-east-1`)
- Initial schema and RLS policies applied; all 20 public tables have RLS enabled
- Public shop assets and private seller-verification storage buckets
- Buyer profile creation and pending seller/agent role requests
- Sign-up, login, dashboard and marketplace starter screens
- POPIA notice, language message files and PWA manifest
- Five domain-rule tests passed with Node's built-in test runner

## Local setup

1. Use Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key.
3. Run `npm install`, then `npm run dev`.

Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or commit it to Git.

## Database

Migrations are in `supabase/migrations/` and have been applied to the production Supabase project. Do not edit an applied migration; add a new migration for every schema change.

## Security notes

- Browser-supplied metadata never grants privileged roles. Seller and agent requests require administrator review.
- Order/payment writes are server-only at this stage. Do not add browser-side payment success logic.
- Online payments are intentionally unimplemented pending final provider approval.
- Cash payment confirmation must be recorded server-side with actor and timestamp.
- Seller verification is an internal platform check, not legal registration or government approval.

## Infrastructure

- Supabase project: `spazalink-production`
- Project ref: `cnkfehrftjvknrohayna`
- Region: São Paulo (`sa-east-1`)
- Project URL: `https://cnkfehrftjvknrohayna.supabase.co`
