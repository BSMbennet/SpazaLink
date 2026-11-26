-- Move privileged order and consent implementations out of exposed public schema.
grant usage on schema private to authenticated;

alter function public.create_cash_order(uuid,public.fulfillment_type,text,text,jsonb) set schema private;
alter function public.create_online_order(uuid,public.fulfillment_type,text,text,jsonb) set schema private;
alter function public.record_paystack_initialization(uuid,text,bigint) set schema private;
alter function public.seller_process_order(uuid,text,text) set schema private;
alter function public.set_whatsapp_consent(text,boolean) set schema private;

revoke all on function private.create_cash_order(uuid,public.fulfillment_type,text,text,jsonb) from public,anon;
revoke all on function private.create_online_order(uuid,public.fulfillment_type,text,text,jsonb) from public,anon;
revoke all on function private.record_paystack_initialization(uuid,text,bigint) from public,anon;
revoke all on function private.seller_process_order(uuid,text,text) from public,anon;
revoke all on function private.set_whatsapp_consent(text,boolean) from public,anon;

grant execute on function private.create_cash_order(uuid,public.fulfillment_type,text,text,jsonb) to authenticated;
grant execute on function private.create_online_order(uuid,public.fulfillment_type,text,text,jsonb) to authenticated;
grant execute on function private.record_paystack_initialization(uuid,text,bigint) to authenticated;
grant execute on function private.seller_process_order(uuid,text,text) to authenticated;
grant execute on function private.set_whatsapp_consent(text,boolean) to authenticated;

create or replace function public.create_cash_order(p_shop_id uuid,p_fulfillment public.fulfillment_type,p_delivery_address text,p_buyer_note text,p_items jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_cash_order(p_shop_id,p_fulfillment,p_delivery_address,p_buyer_note,p_items); $$;
create or replace function public.create_online_order(p_shop_id uuid,p_fulfillment public.fulfillment_type,p_delivery_address text,p_buyer_note text,p_items jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_online_order(p_shop_id,p_fulfillment,p_delivery_address,p_buyer_note,p_items); $$;
create or replace function public.record_paystack_initialization(p_order_id uuid,p_reference text,p_amount_minor bigint)
returns uuid language sql security invoker set search_path = ''
as $$ select private.record_paystack_initialization(p_order_id,p_reference,p_amount_minor); $$;
create or replace function public.seller_process_order(p_order_id uuid,p_action text,p_note text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.seller_process_order(p_order_id,p_action,p_note); $$;
create or replace function public.set_whatsapp_consent(p_phone_e164 text,p_opted_in boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.set_whatsapp_consent(p_phone_e164,p_opted_in); $$;

revoke all on function public.create_cash_order(uuid,public.fulfillment_type,text,text,jsonb) from public,anon;
revoke all on function public.create_online_order(uuid,public.fulfillment_type,text,text,jsonb) from public,anon;
revoke all on function public.record_paystack_initialization(uuid,text,bigint) from public,anon;
revoke all on function public.seller_process_order(uuid,text,text) from public,anon;
revoke all on function public.set_whatsapp_consent(text,boolean) from public,anon;
grant execute on function public.create_cash_order(uuid,public.fulfillment_type,text,text,jsonb) to authenticated;
grant execute on function public.create_online_order(uuid,public.fulfillment_type,text,text,jsonb) to authenticated;
grant execute on function public.record_paystack_initialization(uuid,text,bigint) to authenticated;
grant execute on function public.seller_process_order(uuid,text,text) to authenticated;
grant execute on function public.set_whatsapp_consent(text,boolean) to authenticated;

drop policy if exists payment_transactions_buyer_read on public.payment_transactions;
create policy payment_transactions_buyer_read on public.payment_transactions
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.buyer_id = (select auth.uid())
  ));
