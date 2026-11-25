# Phase F — Paystack online checkout

## Implemented
- Separate atomic online-order RPC. It validates buyer, shop, fulfilment, product availability and stock under row locks, then creates an online order with payment status pending.
- Paystack transaction initialization runs only in the Next.js server action. The secret key is never sent to the browser.
- ZAR is used and the amount is sent in cents (minor units), calculated from the database-created order total.
- A payment reference and expected amount are recorded against the order before redirecting to Paystack.
- The backend webhook verifies Paystack's signature against the original raw request body. It supports the current timestamped Paystack-Signature header and the legacy x-paystack-signature header.
- On charge.success, the backend calls Paystack's Verify Transaction API and compares returned reference, status, amount and currency before calling the restricted database finalization RPC.
- Payment finalization is idempotent. Only the backend service-role client can invoke the finalization RPC.
- Seller order processing is blocked for online orders until payment_status is paid. Cash orders retain their existing audited cash-confirmation workflow.
- The callback page explicitly says that returning from checkout is not proof of payment; it displays the status recorded by the server.

## Required secrets and configuration

### Vercel frontend environment
- NEXT_PUBLIC_APP_URL — deployed SpazaLink origin, for example https://your-domain.example
- PAYSTACK_SECRET_KEY — Paystack test secret key initially (sk_test_...); server-only, never prefix with NEXT_PUBLIC_

### Backend service environment
- PAYSTACK_SECRET_KEY — same Paystack test secret key
- PAYSTACK_WEBHOOK_SECRET — webhook signing secret from Paystack Dashboard (whsec_...)
- SUPABASE_SERVICE_ROLE_KEY — Supabase service-role key; backend only, never expose to browser or commit a real value

Set Paystack to test mode first. Configure its webhook URL as:
https://YOUR_BACKEND_HOST/v1/webhooks/paystack

Subscribe to charge.success. The backend verifies every successful event with Paystack's Verify Transaction API before marking an order paid.

## Not yet live
- No real Paystack credentials have been supplied or configured in Vercel/Render.
- No Paystack merchant onboarding or live-mode approval has been verified.
- No live charge has been made. Do not switch to live keys until test checkout, webhook delivery and amount matching have been tested end-to-end.
- Failed or abandoned online orders currently retain their stock reservation until cancelled by the seller or an operational expiry/release process is added. Add an expiry/release workflow before a broad public launch.
- The callback page relies on the webhook to update payment status; it does not infer success from the browser redirect.
