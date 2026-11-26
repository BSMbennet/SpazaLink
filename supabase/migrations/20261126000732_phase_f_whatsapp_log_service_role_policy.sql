create policy whatsapp_notification_log_service_role
on public.whatsapp_notification_log
for all to service_role
using (true)
with check (true);
