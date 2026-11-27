# Pilot readiness audit — 26 November 2026

This is a read-only audit of the connected Supabase production project. No database settings, production hosting, secrets or domains were changed.

## Supabase production snapshot

Project status: `ACTIVE_HEALTHY`  
Region: `sa-east-1`  
Postgres: `17.12`  
Applied migrations: 23  
Public tables: 25  
Public tables with RLS enabled: 25  
Public tables without RLS: 0

The applied migration history contains 23 versions from `20261125221630` through `20261126180323`. The GitHub repository currently contains 22 SQL migration files; the first migration, `20261125221630_initial_phase_one_schema`, is missing. The later migration files must not be treated as a complete clean-database restore path without that baseline schema and a tested restore procedure.

## Advisor results

### Security

One warning:
- `auth_leaked_password_protection`: Supabase Auth leaked-password protection is disabled.

Supabase checks proposed passwords against HaveIBeenPwned.org when this option is enabled. Enable it in the Supabase Dashboard under Authentication password security, then re-run the security advisor. This audit did not change Auth settings.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Performance

The advisor reports:
- 20 foreign keys without a covering index.
- 2 pairs of overlapping permissive SELECT policies.
- 12 unused indexes.

The unused-index notices are expected to be noisy on a nearly empty pilot database. Do not remove those indexes based on this snapshot.

The 20 missing foreign-key indexes are:
- `agent_commissions(agent_id)`
- `agent_commissions(referral_id)`
- `agent_referrals(agent_id)`
- `agent_referrals(shop_id)`
- `expenses(shop_id)`
- `order_items(order_id)`
- `order_items(product_id)`
- `orders(cash_confirmed_by)`
- `payments(order_id)`
- `reviews(buyer_id)`
- `reviews(shop_id)`
- `role_requests(reviewed_by)`
- `seller_transactions(order_id)`
- `seller_verifications(reviewed_by)`
- `seller_verifications(shop_id)`
- `seller_verifications(submitted_by)`
- `stock_movements(changed_by)`
- `stock_movements(order_id)`
- `stock_movements(product_id)`
- `whatsapp_notification_log(recipient_user_id)`

The two overlapping SELECT policy pairs are:
- `products_owner_manage` and `products_public_read_active`
- `shop_hours_owner_manage` and `shop_hours_public_read`

These should be consolidated only after checking anonymous and authenticated read behavior, seller ownership, and admin access. Do not delete or weaken policies just to silence the performance advisor.

### Health

No health-advisor findings were returned.

## RLS spot-check

All 25 public tables have Row Level Security enabled. A policy listing was reviewed for buyer, seller/shop-owner, admin and public read paths. This is a configuration review only; it does not prove that cross-account access is correctly blocked in real authenticated sessions.

Still required:
- Test with two buyer accounts and two seller accounts.
- Confirm a buyer cannot see another buyer's order, payment, profile or private documents.
- Confirm one seller cannot see or modify another seller's products, stock, expenses, credit book or transactions.
- Confirm public/anonymous users can only see active marketplace content and intentionally public reviews.
- Confirm admin-only verification and webhook data stays private.
- Test two buyers competing for the last product unit.

## Proposed database indexes

The proposed index statements are recorded separately in [database-indexes-proposed.sql](database-indexes-proposed.sql). They are a review artifact only and have not been applied to the database.

## Actions still required

1. Enable Supabase leaked-password protection and rerun the security advisor.
2. Obtain the missing initial schema migration from the original project history or produce a verified schema-only export and tested restore procedure. Do not fabricate an initial migration from the current schema and then replay later migrations over it.
3. Generate a timestamped migration with the Supabase CLI for the 20 missing foreign-key indexes, test it on a separate database, then apply it to production after review.
4. Review the two overlapping policy pairs and prove equivalent access before changing them.
5. Complete authenticated RLS and stock-race tests with separate accounts.
6. Keep the Fastify API on a suitable non-sleeping host before any real commercial pilot; moving the frontend alone does not solve Render Free sleep.

## Conclusion

The production database is healthy and has RLS enabled on every public table, but it is not fully pilot-ready: leaked-password protection is off, database restore history is incomplete, performance findings remain, and authenticated cross-account tests have not been completed.
