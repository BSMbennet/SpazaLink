-- Supervised pilot mode: cash on collection, with no SpazaLink commission.
-- This intentionally locks shop fulfilment and fee settings until a later migration
-- explicitly reopens delivery and commission after the pilot gates are passed.

begin;

update public.shops
set platform_fee_percent = 0,
    offers_collection = true,
    offers_delivery = false,
    delivery_fee = 0,
    updated_at = now();

alter table public.shops
  alter column platform_fee_percent set default 0;

alter table public.shops
  add constraint shops_pilot_zero_platform_fee_check
  check (platform_fee_percent = 0);

alter table public.shops
  add constraint shops_pilot_collection_only_check
  check (offers_collection is true and offers_delivery is false and delivery_fee = 0);

-- Disable direct authenticated creation/initialisation of online orders while
-- Paystack seller settlement, refunds and abandoned-payment stock release are unfinished.
revoke all on function public.create_online_order(uuid, public.fulfillment_type, text, text, jsonb)
  from public, anon, authenticated;

revoke all on function public.record_paystack_initialization(uuid, text, bigint)
  from public, anon, authenticated;

commit;
