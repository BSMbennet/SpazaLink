create table public.role_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 requested_role public.app_role not null check (requested_role in ('seller','agent')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, review_notes text,
 created_at timestamptz not null default now()
);
create index role_requests_user_created_idx on public.role_requests(user_id,created_at desc);
alter table public.role_requests enable row level security;
create policy role_requests_read_own_or_admin on public.role_requests for select to authenticated
 using (user_id = (select auth.uid()) or (select private.has_role('admin')));
revoke insert,update,delete on public.role_requests from anon,authenticated;
create or replace function private.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare requested_role_text text;
begin
 insert into public.profiles (id,role,full_name,phone,popia_consent_at)
 values (new.id,'buyer',nullif(new.raw_user_meta_data ->> 'full_name',''),
  nullif(new.raw_user_meta_data ->> 'phone',''),
  case when new.raw_user_meta_data ->> 'popia_consent' = 'true' then now() else null end)
 on conflict (id) do nothing;
 requested_role_text := coalesce(new.raw_user_meta_data ->> 'requested_role','');
 if requested_role_text in ('seller','agent') then
  insert into public.role_requests (user_id,requested_role) values (new.id,requested_role_text::public.app_role);
 end if;
 return new;
end;
$$;
