# Phase D — Seller order workflow

## Delivered
- Seller-only order inbox at `/seller/orders`.
- Guarded order actions: accept, reject, mark ready, complete collection/delivery, and cancel.
- Cancellation restores product stock and writes compensating stock movements inside the same database transaction.
- Cash confirmation is available only after collection or delivery and records the seller and timestamp.
- Buyer order detail shows the event timeline and whether cash is still due or confirmed.
- Every action is stored in `public.order_events`; buyers and the owning seller can read events.

## Security and operating rules
- The database RPC checks `auth.uid()` and shop ownership, locks the order row, validates allowed state transitions, and owns the stock/payment writes.
- `order_events` has RLS enabled and no direct client write grants.
- Cash orders remain `cash_due` until the seller confirms receipt. This does not process online payments.
- The RPC is an intentional authenticated `SECURITY DEFINER` API operation. Supabase's advisor flags it because signed-in users can invoke it; the function performs explicit ownership and state checks. Anonymous execution is revoked.

## Verification limits
- The pilot database currently has no live profiles, shops, products, or orders. End-to-end seller/buyer action testing therefore still requires a real approved seller and a buyer placing a genuine cash order.
- Static contract tests cover the SQL guardrails. CI must still pass typecheck, lint, tests, and production builds before this phase is considered verified.
