import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20261125235521_phase_f_paystack_online_checkout.sql', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../../supabase/migrations/20261125235713_phase_f_require_verified_payment_before_seller_acceptance.sql', import.meta.url), 'utf8');
const action = readFileSync(new URL('../src/app/actions/orders.ts', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../../backend/src/server.ts', import.meta.url), 'utf8');
const callback = readFileSync(new URL('../src/app/payments/paystack/callback/page.tsx', import.meta.url), 'utf8');

test('online order is created separately from the cash checkout', () => {
  assert.match(migration, /create or replace function public\\.create_online_order/i);
  assert.match(migration, /'online'::public\\.payment_method, 'pending'::public\\.payment_status/i);
  assert.match(migration, /for update of p/i);
  assert.match(migration, /record_paystack_initialization/i);
});

test('Paystack secret is used only by a server action and currency is ZAR', () => {
  assert.match(action, /process\\.env\\.PAYSTACK_SECRET_KEY/);
  assert.match(action, /currency: 'ZAR'/);
  assert.match(action, /https:\\/\\/api\\.paystack\\.co\\/transaction\\/initialize/);
  assert.doesNotMatch(action, /NEXT_PUBLIC_PAYSTACK_SECRET_KEY/);
});

test('webhook verifies raw body signature and verifies the transaction with Paystack', () => {
  assert.match(backend, /parseAs: 'buffer'/);
  assert.match(backend, /createHmac\\('sha512'/);
  assert.match(backend, /timingSafeEqual/);
  assert.match(backend, /transaction\\/verify\\//);
  assert.match(backend, /finalize_paystack_payment/);
});

test('seller cannot accept an online order before verified payment', () => {
  assert.match(gate, /ONLINE_PAYMENT_NOT_CONFIRMED/);
  assert.match(gate, /v_order\\.payment_status <> 'paid'/);
});

test('browser return does not treat a redirect as payment proof', () => {
  assert.match(callback, /Returning to this page does not by itself mean the payment succeeded/);
});
