import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../../supabase/migrations/20261125225211_create_atomic_cash_order_rpc.sql', import.meta.url), 'utf8');

test('cash-order RPC requires an authenticated buyer', () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /AUTHENTICATION_REQUIRED/);
  assert.match(migration, /BUYER_ACCOUNT_REQUIRED/);
});
test('cash-order RPC locks product rows before validating stock', () => {
  assert.match(migration, /for update of p/i);
  assert.match(migration, /stock_quantity < v_item\.quantity/);
  assert.match(migration, /stock_quantity >= v_item\.quantity/);
});
test('cash-order RPC only accepts active products from the selected shop', () => {
  assert.match(migration, /p\.shop_id = p_shop_id/);
  assert.match(migration, /p\.is_active = true/);
  assert.match(migration, /PRODUCT_NOT_AVAILABLE/);
});
test('cash checkout records cash due and the configured platform fee', () => {
  assert.match(migration, /'cash'::public\.payment_method/);
  assert.match(migration, /'cash_due'::public\.payment_status/);
  assert.match(migration, /v_shop\.platform_fee_percent/);
});
test('cash-order RPC is not executable by anonymous users', () => {
  assert.match(migration, /revoke all on function[\s\S]+from public, anon/i);
  assert.match(migration, /grant execute on function[\s\S]+to authenticated/i);
});
