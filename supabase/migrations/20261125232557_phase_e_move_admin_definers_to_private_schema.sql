-- Keep privileged admin implementation functions outside exposed API schemas.
-- Public PostgREST RPCs are invoker wrappers; private implementations retain
-- auth.uid() and private.has_role('admin') checks.
alter function public.admin_review_role_request(uuid,text,text) set schema private;
alter function public.admin_review_seller_document(uuid,text,text) set schema private;
alter function public.admin_review_shop(uuid,text,text) set schema private;

grant usage on schema private to authenticated;
revoke all on function private.admin_review_role_request(uuid,text,text) from public,anon;
revoke all on function private.admin_review_seller_document(uuid,text,text) from public,anon;
revoke all on function private.admin_review_shop(uuid,text,text) from public,anon;
grant execute on function private.admin_review_role_request(uuid,text,text) to authenticated;
grant execute on function private.admin_review_seller_document(uuid,text,text) to authenticated;
grant execute on function private.admin_review_shop(uuid,text,text) to authenticated;

create or replace function public.admin_review_role_request(p_request_id uuid,p_decision text,p_notes text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_review_role_request(p_request_id,p_decision,p_notes); $$;
create or replace function public.admin_review_seller_document(p_document_id uuid,p_decision text,p_notes text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_review_seller_document(p_document_id,p_decision,p_notes); $$;
create or replace function public.admin_review_shop(p_shop_id uuid,p_decision text,p_notes text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_review_shop(p_shop_id,p_decision,p_notes); $$;

revoke all on function public.admin_review_role_request(uuid,text,text) from public,anon;
revoke all on function public.admin_review_seller_document(uuid,text,text) from public,anon;
revoke all on function public.admin_review_shop(uuid,text,text) from public,anon;
grant execute on function public.admin_review_role_request(uuid,text,text) to authenticated;
grant execute on function public.admin_review_seller_document(uuid,text,text) to authenticated;
grant execute on function public.admin_review_shop(uuid,text,text) to authenticated;
