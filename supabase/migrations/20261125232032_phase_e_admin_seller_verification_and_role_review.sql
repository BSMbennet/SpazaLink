-- Phase E: admin review for seller/agent role requests, private seller documents and shop verification.
alter table public.shops
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending','approved','rejected')),
  add column if not exists verification_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id);

create table if not exists public.seller_verification_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('identity','business','food_handling','other')),
  object_path text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text
);
create index if not exists seller_verification_user_status_idx on public.seller_verification_documents(user_id,status,submitted_at desc);
alter table public.seller_verification_documents enable row level security;
revoke all on public.seller_verification_documents from anon,authenticated;
grant select,insert on public.seller_verification_documents to authenticated;
create policy "Seller documents visible to owner and admins"
on public.seller_verification_documents for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_role('admin'::public.app_role)));
create policy "Seller can submit own verification documents"
on public.seller_verification_documents for insert to authenticated
with check (
  user_id = (select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null
  and exists(select 1 from public.role_requests rr where rr.user_id=(select auth.uid()) and rr.requested_role='seller'::public.app_role)
);

create or replace function public.admin_review_role_request(p_request_id uuid,p_decision text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_request public.role_requests%rowtype;
begin
  if v_admin is null or not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='ADMIN_ACCESS_REQUIRED'; end if;
  if p_request_id is null or p_decision not in ('approve','reject') or (p_notes is not null and length(p_notes)>500) then raise exception using errcode='22023',message='INVALID_REVIEW_INPUT'; end if;
  select * into v_request from public.role_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='ROLE_REQUEST_NOT_FOUND'; end if;
  if v_request.status<>'pending' then raise exception using errcode='P0001',message='ROLE_REQUEST_ALREADY_REVIEWED'; end if;
  if v_request.requested_role not in ('seller'::public.app_role,'agent'::public.app_role) then raise exception using errcode='22023',message='ROLE_NOT_REVIEWABLE'; end if;
  update public.role_requests set status=case when p_decision='approve' then 'approved' else 'rejected' end,
    reviewed_by=v_admin,reviewed_at=now(),review_notes=nullif(btrim(p_notes),'') where id=v_request.id;
  if p_decision='approve' then
    update public.profiles set role=v_request.requested_role,updated_at=now()
      where id=v_request.user_id and role='buyer'::public.app_role;
    if not found then raise exception using errcode='P0001',message='PROFILE_ROLE_NOT_ELIGIBLE'; end if;
  end if;
  insert into public.notifications(user_id,title,body,href) values(v_request.user_id,
    case when p_decision='approve' then 'Account role approved' else 'Account role request reviewed' end,
    case when p_decision='approve' then 'Your '||v_request.requested_role::text||' account request was approved.'
      else 'Your '||v_request.requested_role::text||' account request was not approved. Sign in to see any review note.' end,'/dashboard');
  return jsonb_build_object('ok',true,'status',case when p_decision='approve' then 'approved' else 'rejected' end);
end; $$;

create or replace function public.admin_review_seller_document(p_document_id uuid,p_decision text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_document public.seller_verification_documents%rowtype;
begin
  if v_admin is null or not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='ADMIN_ACCESS_REQUIRED'; end if;
  if p_document_id is null or p_decision not in ('approve','reject') or (p_notes is not null and length(p_notes)>500) then raise exception using errcode='22023',message='INVALID_REVIEW_INPUT'; end if;
  select * into v_document from public.seller_verification_documents where id=p_document_id for update;
  if not found then raise exception using errcode='P0002',message='DOCUMENT_NOT_FOUND'; end if;
  if v_document.status<>'pending' then raise exception using errcode='P0001',message='DOCUMENT_ALREADY_REVIEWED'; end if;
  update public.seller_verification_documents set status=case when p_decision='approve' then 'approved' else 'rejected' end,
    reviewed_by=v_admin,reviewed_at=now(),review_notes=nullif(btrim(p_notes),'') where id=v_document.id;
  insert into public.notifications(user_id,title,body,href) values(v_document.user_id,'Seller document reviewed',
    case when p_decision='approve' then 'A seller verification document was approved.' else 'A seller verification document needs attention. Sign in to review the note.' end,'/seller/verification');
  return jsonb_build_object('ok',true,'status',case when p_decision='approve' then 'approved' else 'rejected' end);
end; $$;

create or replace function public.admin_review_shop(p_shop_id uuid,p_decision text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := auth.uid(); v_shop public.shops%rowtype; v_new_status public.shop_status; v_verification text;
begin
  if v_admin is null or not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='ADMIN_ACCESS_REQUIRED'; end if;
  if p_shop_id is null or p_decision not in ('approve','reject','suspend') or (p_notes is not null and length(p_notes)>500) then raise exception using errcode='22023',message='INVALID_REVIEW_INPUT'; end if;
  select * into v_shop from public.shops where id=p_shop_id for update;
  if not found then raise exception using errcode='P0002',message='SHOP_NOT_FOUND'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_shop.owner_id and p.role='seller'::public.app_role) then raise exception using errcode='P0001',message='SELLER_ROLE_NOT_APPROVED'; end if;
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

revoke all on function public.admin_review_role_request(uuid,text,text) from public,anon;
revoke all on function public.admin_review_seller_document(uuid,text,text) from public,anon;
revoke all on function public.admin_review_shop(uuid,text,text) from public,anon;
grant execute on function public.admin_review_role_request(uuid,text,text) to authenticated;
grant execute on function public.admin_review_seller_document(uuid,text,text) to authenticated;
grant execute on function public.admin_review_shop(uuid,text,text) to authenticated;
