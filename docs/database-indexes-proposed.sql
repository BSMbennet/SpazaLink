-- Proposed performance indexes from the 2026-11-26 Supabase advisor audit.
-- This is a review artifact, NOT an applied migration.
-- Test on a separate database and create a timestamped migration with:
--   supabase migration new index_uncovered_foreign_keys
-- Review the generated file and then test the full migration chain before db push.

create index if not exists agent_commissions_agent_id_idx
  on public.agent_commissions (agent_id);
create index if not exists agent_commissions_referral_id_idx
  on public.agent_commissions (referral_id);
create index if not exists agent_referrals_agent_id_idx
  on public.agent_referrals (agent_id);
create index if not exists agent_referrals_shop_id_idx
  on public.agent_referrals (shop_id);
create index if not exists expenses_shop_id_idx
  on public.expenses (shop_id);
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
create index if not exists order_items_product_id_idx
  on public.order_items (product_id);
create index if not exists orders_cash_confirmed_by_idx
  on public.orders (cash_confirmed_by);
create index if not exists payments_order_id_idx
  on public.payments (order_id);
create index if not exists reviews_buyer_id_idx
  on public.reviews (buyer_id);
create index if not exists reviews_shop_id_idx
  on public.reviews (shop_id);
create index if not exists role_requests_reviewed_by_idx
  on public.role_requests (reviewed_by);
create index if not exists seller_transactions_order_id_idx
  on public.seller_transactions (order_id);
create index if not exists seller_verifications_reviewed_by_idx
  on public.seller_verifications (reviewed_by);
create index if not exists seller_verifications_shop_id_idx
  on public.seller_verifications (shop_id);
create index if not exists seller_verifications_submitted_by_idx
  on public.seller_verifications (submitted_by);
create index if not exists stock_movements_changed_by_idx
  on public.stock_movements (changed_by);
create index if not exists stock_movements_order_id_idx
  on public.stock_movements (order_id);
create index if not exists stock_movements_product_id_idx
  on public.stock_movements (product_id);
create index if not exists whatsapp_notification_log_recipient_user_id_idx
  on public.whatsapp_notification_log (recipient_user_id);
