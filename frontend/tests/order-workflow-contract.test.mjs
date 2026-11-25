import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20261125230325_phase_d_seller_order_workflow_and_cash_audit.sql', import.meta.url), 'utf8');

test('seller workflow locks the order before validating and changing state', () => {
  assert.match(migration, /where id = p_order_id for update/i);
  assert.match(migration, /v_shop\.owner_id <> v_user_id/i);
  assert.match(migration, /INVALID_ORDER_STATE_TRANSITION/);
});

test('cash receipt can only be confirmed for completed cash orders', () => {
  assert.match(migration, /payment_method <> 'cash'/i);
  assert.match(migration, /payment_status <> 'cash_due'/i);
  assert.match(migration, /status not in \('collected'.*'delivered'/i);
  assert.match(migration, /cash_confirmed_by = v_user_id/i);
  assert.match(migration, /cash_confirmed_at = now\(\)/i);
});

test('cancellation restores stock and writes a matching stock movement', () => {
  assert.match(migration, /v_new_status = 'cancelled'/i);
  assert.match(migration, /stock_quantity = stock_quantity \+ v_item\.quantity/i);
  assert.match(migration, /'order_cancelled'/i);
});

test('order events are protected by RLS and readable only by participants', () => {
  assert.match(migration, /alter table public\.order_events enable row level security/i);
  assert.match(migration, /o\.buyer_id = \(select auth\.uid\(\)\) or s\.owner_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /revoke all on public\.order_events from anon, authenticated/i);
});

test('seller RPC is unavailable to anon and explicitly granted to authenticated', () => {
  assert.match(migration, /revoke all on function public\.seller_process_order\(uuid,text,text\) from public,anon/i);
  assert.match(migration, /grant execute on function public\.seller_process_order\(uuid,text,text\) to authenticated/i);
});
