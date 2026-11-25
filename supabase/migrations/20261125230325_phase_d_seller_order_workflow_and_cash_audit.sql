-- Phase D: seller order workflow, stock-safe cancellation and cash receipt audit.
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('accepted','rejected','ready','completed','cash_confirmed','cancelled')),
  from_status public.order_status not null,
  to_status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at desc);
alter table public.order_events enable row level security;
revoke all on public.order_events from anon, authenticated;
grant select on public.order_events to authenticated;
create policy "Order participants can view order events"
on public.order_events for select to authenticated
using (exists (
  select 1 from public.orders o join public.shops s on s.id = o.shop_id
  where o.id = order_events.order_id
    and (o.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
));

create or replace function public.seller_process_order(p_order_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_shop public.shops%rowtype;
  v_new_status public.order_status;
  v_event text;
  v_item record;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED'; end if;
  if p_order_id is null or p_action not in ('accept','reject','ready','complete','confirm_cash','cancel') then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_ACTION';
  end if;
  if p_note is not null and length(p_note) > 300 then raise exception using errcode = '22023', message = 'ORDER_NOTE_TOO_LONG'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  select * into v_shop from public.shops where id = v_order.shop_id;
  if not found or v_shop.owner_id <> v_user_id then raise exception using errcode = '42501', message = 'SELLER_ACCESS_REQUIRED'; end if;

  if p_action = 'confirm_cash' then
    if v_order.payment_method <> 'cash'::public.payment_method
       or v_order.payment_status <> 'cash_due'::public.payment_status
       or v_order.status not in ('collected'::public.order_status, 'delivered'::public.order_status) then
      raise exception using errcode = 'P0001', message = 'CASH_CONFIRMATION_NOT_ALLOWED';
    end if;
    update public.orders set payment_status = 'cash_confirmed'::public.payment_status,
      cash_confirmed_by = v_user_id, cash_confirmed_at = now(), updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id,actor_id,event_type,from_status,to_status,note)
      values (v_order.id,v_user_id,'cash_confirmed',v_order.status,v_order.status,nullif(btrim(p_note),''));
    insert into public.notifications(user_id,title,body,href)
      values (v_order.buyer_id,'Cash payment confirmed','The seller confirmed cash for order #' || v_order.order_number::text || '.','/orders/' || v_order.id::text);
    return jsonb_build_object('ok',true,'status',v_order.status,'payment_status','cash_confirmed');
  end if;

  if v_order.status in ('cancelled'::public.order_status,'collected'::public.order_status,'delivered'::public.order_status,'refunded'::public.order_status) then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_FINAL';
  end if;
  if p_action = 'accept' and v_order.status = 'placed'::public.order_status then
    v_new_status := 'accepted'::public.order_status; v_event := 'accepted';
  elsif p_action = 'ready' and v_order.status = 'accepted'::public.order_status then
    v_new_status := 'ready'::public.order_status; v_event := 'ready';
  elsif p_action = 'complete' and v_order.status = 'ready'::public.order_status then
    v_new_status := case when v_order.fulfillment = 'collection'::public.fulfillment_type then 'collected'::public.order_status else 'delivered'::public.order_status end;
    v_event := 'completed';
  elsif p_action in ('reject','cancel') and v_order.status in ('placed'::public.order_status,'accepted'::public.order_status) then
    v_new_status := 'cancelled'::public.order_status; v_event := case when p_action = 'reject' then 'rejected' else 'cancelled' end;
  else raise exception using errcode = 'P0001', message = 'INVALID_ORDER_STATE_TRANSITION';
  end if;

  if v_new_status = 'cancelled'::public.order_status then
    for v_item in select oi.product_id,oi.quantity from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id is not null order by oi.product_id
    loop
      update public.products set stock_quantity = stock_quantity + v_item.quantity, updated_at = now()
        where id = v_item.product_id;
      if found then
        insert into public.stock_movements(product_id,order_id,changed_by,quantity_delta,reason)
          values (v_item.product_id,v_order.id,v_user_id,v_item.quantity,'order_cancelled');
      end if;
    end loop;
  end if;

  update public.orders set status = v_new_status,
    accepted_at = case when v_new_status = 'accepted'::public.order_status then now() else accepted_at end,
    ready_at = case when v_new_status = 'ready'::public.order_status then now() else ready_at end,
    completed_at = case when v_new_status in ('collected'::public.order_status,'delivered'::public.order_status) then now() else completed_at end,
    updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id,actor_id,event_type,from_status,to_status,note)
    values (v_order.id,v_user_id,v_event,v_order.status,v_new_status,nullif(btrim(p_note),''));
  insert into public.notifications(user_id,title,body,href) values (
    v_order.buyer_id,
    case v_new_status when 'accepted' then 'Order accepted' when 'ready' then 'Order ready' when 'cancelled' then 'Order cancelled' else 'Order completed' end,
    'Your order #' || v_order.order_number::text || ' is now ' || v_new_status::text || '.',
    '/orders/' || v_order.id::text
  );
  return jsonb_build_object('ok',true,'status',v_new_status,'payment_status',v_order.payment_status);
end;
$$;
revoke all on function public.seller_process_order(uuid,text,text) from public,anon;
grant execute on function public.seller_process_order(uuid,text,text) to authenticated;
