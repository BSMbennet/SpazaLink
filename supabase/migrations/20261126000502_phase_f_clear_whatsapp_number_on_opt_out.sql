create or replace function private.set_whatsapp_consent(p_phone_e164 text, p_opted_in boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if p_opted_in then
    if p_phone_e164 is null or p_phone_e164 !~ '^[+][1-9][0-9]{7,14}$' then
      raise exception using errcode='22023', message='INVALID_E164_PHONE';
    end if;
    insert into public.whatsapp_consents(user_id,phone_e164,opted_in,consented_at,revoked_at,updated_at)
    values(v_user_id,p_phone_e164,true,now(),null,now())
    on conflict(user_id) do update set phone_e164=excluded.phone_e164,opted_in=true,consented_at=now(),revoked_at=null,updated_at=now();
  else
    insert into public.whatsapp_consents(user_id,phone_e164,opted_in,revoked_at,updated_at)
    values(v_user_id,null,false,now(),now())
    on conflict(user_id) do update set phone_e164=null,opted_in=false,revoked_at=now(),updated_at=now();
  end if;
end;
$$;
revoke all on function private.set_whatsapp_consent(text,boolean) from public,anon;
grant execute on function private.set_whatsapp_consent(text,boolean) to authenticated;
