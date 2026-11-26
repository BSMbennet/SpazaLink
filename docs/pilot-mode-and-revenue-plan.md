# SpazaLink supervised pilot mode and revenue plan

Updated: 26 November 2026

## Pilot operating mode

This build is configured for the supervised Thohoyandou pilot only:

- Buyers place cash orders and collect from the shop.
- Sellers accept, prepare, mark collected, then confirm cash received.
- Online checkout and direct online-order database functions are disabled.
- Seller delivery is disabled.
- The SpazaLink platform fee is 0% for new pilot orders.
- Existing order records are not rewritten. They keep their original recorded totals and fees.
- WhatsApp alerts are optional until a real end-to-end message test passes. Each participating seller must still have a named person checking orders and a phone fallback.

The pilot database migration locks shop settings to collection only and 0% fee. A later, reviewed migration must remove these constraints before delivery or fees can be enabled.

## How SpazaLink can make money

### During the pilot: do not charge sellers

Run the usability and repeat-order test first. Do not collect commission while sellers are still proving that the app brings them useful orders. This keeps the pilot simple and lets the team measure demand without arguing about fees.

### After the pilot: start with a simple seller service fee

A practical first model is a commission on completed orders, not on orders that are rejected or cancelled.

Suggested example only; it is not yet an approved fee:

- Start at 5% of the product subtotal on each completed order.
- Review the numbers with sellers after four weeks.
- Consider moving towards 10% only if the value is clear and sellers agree in writing.
- Exclude delivery fees from commission unless the seller agreement explicitly says otherwise.

For cash orders, the seller receives cash directly from the buyer. Until split payments and seller payouts are built and approved, SpazaLink must not pretend to deduct its fee automatically. Instead:
1. Record the fee due for each completed order.
2. Send the seller a weekly statement showing completed orders, fee calculation and amount due.
3. Collect the agreed amount separately by EFT or another documented method.
4. Record each settlement and issue a receipt.

The seller agreement must explain the rate, calculation, payment date, disputes, refunds/cancellations and how the seller can leave. Get legal and tax advice before charging.

### Later revenue options

Only after the core marketplace is reliable:
- Optional paid featured placement for sellers (Phase 3; ask the owner before building).
- Paid seller reports or business tools (Phase 3; ask the owner before building).
- Agent onboarding commission with clear records and agreed rules.

Do not sell ads or featured placement that misleads buyers about seller verification.

## Free-plan limits and launch boundary

- Vercel Hobby is for personal/non-commercial use. Keep it for development or non-commercial testing only; do not run a revenue-generating marketplace on it.
- Render Free sleeps after 15 minutes without traffic and can take about a minute to wake. It is suitable for supervised rehearsal, not reliable live ordering.
- Supabase Free can pause projects after a week of low database activity, has no automatic backups, and has limited database/storage/egress quotas. Keep independent backups and test restores before real customers depend on the system.
- A free commercial hosting option may be possible by moving the Next.js frontend to Cloudflare Workers, but compatibility and all checkout/auth/storage flows must be tested before changing production hosting. Do not migrate automatically.

## Do not enable online payments yet

Before Paystack returns, build and verify seller settlement/split payments, refunds, abandoned-payment stock release, webhook failure handling and payout reconciliation. Obtain written advice from Paystack and a lawyer about marketplace collections and seller payouts. The payment account owner must not receive seller money without a clear, approved settlement process.
