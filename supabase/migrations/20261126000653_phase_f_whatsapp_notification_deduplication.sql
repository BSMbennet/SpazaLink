create table public.whatsapp_notification_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null check (length(event_key) between 2 and 120),
  attempted_at timestamptz not null default now(),
  provider_message_id text,
  unique(order_id,recipient_user_id,event_key)
);
alter table public.whatsapp_notification_log enable row level security;
revoke all on public.whatsapp_notification_log from public,anon,authenticated;
grant select,insert,update on public.whatsapp_notification_log to service_role;
