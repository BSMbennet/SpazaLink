-- Paystack online checkout and immutable payment verification records.
create or replace function public.create_online_order(
  p_shop_id uuid,
  p_fulfillment public.fulfillment_type,
  p_delivery_address text,
  p_buyer_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_role public.app_role;
  v_shop public.shops%rowtype;
  v_item record;
  v_order_id uuid;
  v_order_number bigint;
  v_requested_count integer;
  v_found_count integer := 0;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_platform_fee numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_new_stock integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select p.role into v_profile_role
  from public.profiles p
  where p.id = v_user_id;

  if v_profile_role is distinct from 'buyer'::public.app_role then
    raise exception using errcode = '42501', message = 'BUYER_ACCOUNT_REQUIRED';
  end if;

  if p_shop_id is null or p_fulfillment is null then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_DETAILS';
  end if;

  if p_buyer_note is not null and length(p_buyer_note) > 500 then
    raise exception using errcode = '22023', message = 'BUYER_NOTE_TOO_LONG';
  end if;

  if p_fulfillment = 'seller_delivery'::public.fulfillment_type then
    if p_delivery_address is null or length(btrim(p_delivery_address)) < 4 or length(p_delivery_address) > 300 then
      raise exception using errcode = '22023', message = 'DELIVERY_ADDRESS_REQUIRED';
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_ITEMS';
  end if;

  v_requested_count := jsonb_array_length(p_items);
  if v_requested_count < 1 or v_requested_count > 30 then
    raise exception using errcode = '22023', message = 'ORDER_ITEM_LIMIT_EXCEEDED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
    where requested.product_id is null
       or requested.quantity is null
       or requested.quantity < 1
       or requested.quantity > 100
  ) then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_QUANTITY';
  end if;

  if exists (
    select requested.product_id
    from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
    group by requested.product_id
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'DUPLICATE_PRODUCT_LINES';
  end if;

  select s.* into v_shop
  from public.shops s
  where s.id = p_shop_id
    and s.status = 'active'::public.shop_status
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'SHOP_NOT_AVAILABLE';
  end if;

  if p_fulfillment = 'collection'::public.fulfillment_type and not v_shop.offers_collection then
    raise exception using errcode = 'P0001', message = 'COLLECTION_NOT_AVAILABLE';
  end if;

  if p_fulfillment = 'seller_delivery'::public.fulfillment_type and not v_shop.offers_delivery then
    raise exception using errcode = 'P0001', message = 'SELLER_DELIVERY_NOT_AVAILABLE';
  end if;

  for v_item in
    select p.id, p.name, p.price, p.stock_quantity, requested.quantity
    from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
    join public.products p on p.id = requested.product_id
    where p.shop_id = p_shop_id
      and p.is_active = true
    order by p.id
    for update of p
  loop
    v_found_count := v_found_count + 1;
    if v_item.stock_quantity < v_item.quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
    end if;
    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
  end loop;

  if v_found_count <> v_requested_count then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
  end if;

  if p_fulfillment = 'seller_delivery'::public.fulfillment_type then
    v_delivery_fee := v_shop.delivery_fee;
  end if;

  v_platform_fee := round(v_subtotal * v_shop.platform_fee_percent / 100, 2);
  v_total := v_subtotal + v_delivery_fee;

  insert into public.orders (
    buyer_id, shop_id, fulfillment, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total, buyer_note, delivery_address
  ) values (
    v_user_id, p_shop_id, p_fulfillment, 'online'::public.payment_method, 'pending'::public.payment_status,
    v_subtotal, v_delivery_fee, v_platform_fee, v_total,
    nullif(btrim(p_buyer_note), ''),
    case when p_fulfillment = 'seller_delivery'::public.fulfillment_type then btrim(p_delivery_address) else null end
  )
  returning id, order_number into v_order_id, v_order_number;

  for v_item in
    select p.id, p.name, p.price, requested.quantity
    from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
    join public.products p on p.id = requested.product_id
    where p.shop_id = p_shop_id
      and p.is_active = true
    order by p.id
    for update of p
  loop
    update public.products
    set stock_quantity = stock_quantity - v_item.quantity,
        updated_at = now()
    where id = v_item.id
      and shop_id = p_shop_id
      and stock_quantity >= v_item.quantity
    returning stock_quantity into v_new_stock;

    if not found then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
    end if;

    insert into public.order_items (
      order_id, product_id, product_name_snapshot, unit_price, quantity
    ) values (
      v_order_id, v_item.id, v_item.name, v_item.price, v_item.quantity
    );

    insert into public.stock_movements (
      product_id, order_id, changed_by, quantity_delta, reason
    ) values (
      v_item.id, v_order_id, v_user_id, -v_item.quantity, 'order_placed'
    );
  end loop;

  insert into public.notifications (user_id, title, body, href)
  values (
    v_shop.owner_id,
    'New online order',
    'Order #' || v_order_number::text || ' is waiting for your response.',
    '/seller/orders'
  );

  insert into public.notifications (user_id, title, body, href)
  values (
    v_user_id,
    'Order placed',
    'Your online order #' || v_order_number::text || ' has been sent to the seller.',
    '/orders'
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'placed',
    'payment_method', 'online',
    'payment_status', 'pending',
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'platform_fee', v_platform_fee,
    'total', v_total,
    'currency', 'ZAR'
  );
end;
$$;

revoke all on function public.create_online_order(uuid, public.fulfillment_type, text, text, jsonb) from public, anon;
grant execute on function public.create_online_order(uuid, public.fulfillment_type, text, text, jsonb) to authenticated;

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  reference text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index payment_transactions_status_created_idx on public.payment_transactions(status, created_at);
alter table public.payment_transactions enable row level security;
create policy payment_transactions_buyer_read on public.payment_transactions
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));
revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;

create or replace function public.record_paystack_initialization(p_order_id uuid,p_reference text,p_amount_minor bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTHENTICATION_REQUIRED'; end if;
  if p_reference is null or p_reference !~ '^[A-Za-z0-9.=\\-]{8,100}$' or p_amount_minor<1 then raise exception using errcode='22023',message='INVALID_PAYMENT_REFERENCE'; end if;
  select * into v_order from public.orders where id=p_order_id and buyer_id=auth.uid() for update;
  if not found or v_order.payment_method<>'online'::public.payment_method or v_order.payment_status<>'pending'::public.payment_status then raise exception using errcode='42501',message='ORDER_NOT_PAYABLE'; end if;
  if round(v_order.total*100)::bigint<>p_amount_minor then raise exception using errcode='22023',message='PAYMENT_AMOUNT_MISMATCH'; end if;
  insert into public.payment_transactions(order_id,reference,amount_minor,currency) values(p_order_id,p_reference,p_amount_minor,'ZAR') returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.record_paystack_initialization(uuid,text,bigint) from public,anon;
grant execute on function public.record_paystack_initialization(uuid,text,bigint) to authenticated;

create or replace function public.finalize_paystack_payment(p_reference text,p_amount_minor bigint,p_currency text,p_provider_transaction_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_payment public.payment_transactions%rowtype;
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='SERVICE_ROLE_REQUIRED'; end if;
  select * into v_payment from public.payment_transactions where reference=p_reference for update;
  if not found then return false; end if;
  if v_payment.amount_minor<>p_amount_minor or v_payment.currency<>p_currency then raise exception using errcode='22023',message='PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH'; end if;
  if v_payment.status='paid' then return true; end if;
  update public.payment_transactions set status='paid',provider_transaction_id=p_provider_transaction_id,verified_at=now() where id=v_payment.id;
  update public.orders set payment_status='paid'::public.payment_status,updated_at=now() where id=v_payment.order_id and payment_status='pending'::public.payment_status;
  insert into public.notifications(user_id,title,body,href)
    select buyer_id,'Payment received','Your Paystack payment for order #'||order_number::text||' was confirmed.','/orders' from public.orders where id=v_payment.order_id;
  return true;
end; $$;
revoke all on function public.finalize_paystack_payment(text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.finalize_paystack_payment(text,bigint,text,text) to service_role;
