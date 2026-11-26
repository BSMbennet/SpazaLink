# Cloudflare hosting readiness assessment

Date: 26 November 2026  
Repository inspected: `BSMbennet/SpazaLink`, current `main` branch  
Purpose: evaluate a no-cost hosting path without changing the live deployment or database.

## Decision

**Cloudflare Workers is a candidate for a separate compatibility test, not an approved production host yet. Do not switch the production domain or remove Vercel/Render.**

The current frontend is Next.js 16.4.6. Cloudflare's current Next.js guide recommends vinext for new Workers deployments and says it supports App Router, React Server Components, Server Actions, route handlers and proxy/middleware routes. The same guide explicitly marks vinext as beta and asks teams to run `npx vinext check` and review compatibility before adopting it for production.

Official references:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/nextjs/

## What fits

The inspected application uses:
- Next.js App Router and React Server Components.
- Server Actions for sign-up, password reset, cash orders, seller shop and product updates.
- `frontend/src/proxy.ts` to refresh Supabase sessions.
- Supabase SSR cookies through `cookies()` from `next/headers`.
- Cloudflare R2 through the S3-compatible AWS SDK.
- Static public assets and a web app manifest.

Cloudflare's vinext guide lists App Router, Server Actions, SSR, route handlers and proxy/middleware as supported. This is encouraging, but it is not proof that SpazaLink's exact code works on Workers.

## Compatibility risks to test

1. **Image processing:** `frontend/src/lib/image-optimise.ts` imports `sharp`, and `frontend/src/lib/r2.ts` calls it from server-side upload actions. Sharp is a native Node image-processing dependency. Its compatibility with the Workers runtime must be proven; do not assume a successful Next.js build means image uploads work. If it fails, keep image processing in a Node service or replace it with a tested Workers-compatible approach that still strips metadata and enforces the current file checks.
2. **Node runtime assumptions:** R2 upload code uses `Buffer` and the AWS SDK. Test upload, signed download, delete, and error handling on the actual Workers runtime.
3. **Supabase auth:** test sign-up, sign-in, session refresh, password reset, sign-out and cookie persistence on mobile browsers. A passing build is not sufficient.
4. **Server Actions and request size:** test every order and seller mutation, including the configured 4.5 MB Server Actions body limit and photo uploads.
5. **Headers and redirects:** verify the existing CSP, security headers, auth callback redirects and `NEXT_PUBLIC_APP_URL` behavior on the Workers hostname.
6. **The API remains separate:** the Fastify API is a Node service on Render. Moving only the frontend to Workers does not remove Render Free's sleep/wake issue. A separate, tested backend hosting decision is still required.

## Free-plan limits and terms to check

Cloudflare's current Workers documentation lists the Free plan at 100,000 Worker requests per day and 10 ms CPU time per invocation. Static asset requests are free and unlimited, but dynamic server-rendered requests invoke the Worker. The Free plan has no production SLA and Cloudflare's Self-Serve Subscription Agreement says Free Services can be discontinued at Cloudflare's discretion and disclaims liability for harm arising from Free Services.

Important payment restriction: section 2.2.1(h) of the Self-Serve Subscription Agreement says Free Services must not be used to process or collect personal or business credit-card information on a web property receiving Free Services. SpazaLink's pilot is cash-only, but Paystack may be enabled later. Before any online-payment feature is brought back, obtain written clarification from Cloudflare on whether a redirect to Paystack-hosted checkout is compatible with this restriction. Do not put card-entry fields on the SpazaLink site while using Free Services.

Official references:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://www.cloudflare.com/terms/ (see sections 2.2.1(h), 2.6 and 4)

This assessment is not legal advice. Cloudflare's agreement, product-specific terms and current plan limits must be checked again when the account is configured.

## Safe test sequence

1. Keep `main`, Vercel production, Render and Supabase unchanged.
2. Create a separate test branch and isolated Cloudflare Worker project. Do not point the production domain at it.
3. Run `npx vinext check` against the complete frontend and record every warning.
4. Add vinext non-destructively, keeping the existing `next dev` and `next build` scripts intact.
5. Build and run locally on the Workers runtime. Do not deploy with production Supabase credentials.
6. Use a separate Supabase test project and test accounts to exercise auth, password reset, marketplace reads, cash checkout, seller accept/reject/ready/collected, stock changes and R2 uploads.
7. Verify mobile browser behavior, security headers, redirects, slow network behavior and request/CPU usage.
8. Test the Fastify API separately. Do not call the hosting gate complete until the API no longer sleeps and its health checks pass.
9. Only consider a production cutover after all tests pass, Cloudflare's terms are confirmed for the intended use, and rollback has been rehearsed.

## Current result

- [x] Repository package versions and relevant runtime files inspected.
- [x] Current Cloudflare Next.js guidance and Workers Free limits reviewed.
- [x] Cloudflare Free Services and payment-card restriction identified.
- [ ] Full `vinext check` run against the complete repository.
- [ ] Workers runtime build and isolated test deployment completed.
- [ ] Supabase auth, cash-order and R2 flows tested on Workers.
- [ ] Fastify API moved off the sleeping Render Free service or otherwise made suitable for the pilot.
- [ ] Written confirmation received for any planned online-payment use.

**Conclusion:** continue the pilot's cash-only rehearsal work, but do not call hosting production-ready. Cloudflare Workers may help with the frontend at no charge, but vinext's beta status, the image-processing dependency, the API's separate hosting, and the Free Services terms are unresolved gates.
