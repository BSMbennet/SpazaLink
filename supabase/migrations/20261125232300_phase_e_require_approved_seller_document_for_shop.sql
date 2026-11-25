drop policy if exists "Seller can submit own verification documents" on public.seller_verification_documents;
create policy "Seller can submit own verification documents"
on public.seller_verification_documents for insert to authenticated
with check (
  user_id = (select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null
  and (
    exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='seller'::public.app_role)
    or exists(select 1 from public.role_requests rr where rr.user_id=(select auth.uid())
      and rr.requested_role='seller'::public.app_role and rr.status in ('pending','approved'))
  )
);

create or replace function public.admin_review_shop(p_shop_id uuid,p_decision text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_shop public.shops%rowtype; v_new_status public.shop_status; v_verification text;
begin
  if v_admin is null or not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='ADMIN_ACCESS_REQUIRED'; end if;
  if p_shop_id is null or p_decision not in ('approve','reject','suspend') or (p_notes is not null and length(p_notes)>500) then raise exception using errcode='22023',message='INVALID_REVIEW_INPUT'; end if;
  select * into v_shop from public.shops where id=p_shop_id for update;
  if not found then raise exception using errcode='P0002',message='SHOP_NOT_FOUND'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_shop.owner_id and p.role='seller'::public.app_role) then raise exception using errcode='P0001',message='SELLER_ROLE_NOT_APPROVED'; end if;
  if p_decision='approve' and not exists(select 1 from public.seller_verification_documents d where d.user_id=v_shop.owner_id and d.status='approved') then
    raise exception using errcode='P0001',message='SELLER_DOCUMENT_NOT_APPROVED';
  end if;
  if p_decision='approve' then v_new_status:='active'::public.shop_status; v_verification:='approved';
  elsif p_decision='reject' then v_new_status:='suspended'::public.shop_status; v_verification:='rejected';
  else v_new_status:='suspended'::public.shop_status; v_verification:=v_shop.verification_status; end if;
  update public.shops set status=v_new_status,verification_status=v_verification,verification_notes=nullif(btrim(p_notes),''),
    reviewed_by=v_admin,reviewed_at=now(),verified_by=case when p_decision='approve' then v_admin else verified_by end,
    verified_at=case when p_decision='approve' then now() else verified_at end,updated_at=now() where id=v_shop.id;
  insert into public.notifications(user_id,title,body,href) values(v_shop.owner_id,'Shop review updated',
    case p_decision when 'approve' then 'Your shop was approved and is now visible in the marketplace.'
      when 'reject' then 'Your shop was not approved. Sign in to review the note.'
      else 'Your shop has been suspended. Contact SpazaLink support for details.' end,'/seller/shop');
  return jsonb_build_object('ok',true,'status',v_new_status,'verification_status',v_verification);
end; $$;
