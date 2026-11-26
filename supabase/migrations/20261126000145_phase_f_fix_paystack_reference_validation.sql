create or replace function public.record_paystack_initialization(p_order_id uuid,p_reference text,p_amount_minor bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTHENTICATION_REQUIRED'; end if;
  if p_reference is null or p_reference !~ '^[A-Za-z0-9]{8,100}$' or p_amount_minor<1 then
    raise exception using errcode='22023',message='INVALID_PAYMENT_REFERENCE';
  end if;
  select * into v_order from public.orders where id=p_order_id and buyer_id=auth.uid() for update;
  if not found or v_order.payment_method<>'online'::public.payment_method or v_order.payment_status<>'pending'::public.payment_status then
    raise exception using errcode='42501',message='ORDER_NOT_PAYABLE';
  end if;
  if round(v_order.total*100)::bigint<>p_amount_minor then
    raise exception using errcode='22023',message='PAYMENT_AMOUNT_MISMATCH';
  end if;
  insert into public.payment_transactions(order_id,reference,amount_minor,currency)
  values(p_order_id,p_reference,p_amount_minor,'ZAR') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_paystack_initialization(uuid,text,bigint) from public,anon;
grant execute on function public.record_paystack_initialization(uuid,text,bigint) to authenticated;
