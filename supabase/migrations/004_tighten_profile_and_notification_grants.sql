revoke update on public.profiles from authenticated;
grant update (full_name,phone,avatar_path,preferred_language) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
