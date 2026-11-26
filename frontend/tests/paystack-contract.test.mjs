import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20261125235521_phase_f_paystack_online_checkout.sql', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../../supabase/migrations/20261126000240_phase_f_allow_seller_reject_of_unpaid_online_order.sql', import.meta.url), 'utf8');
const action = readFileSync(new URL('../src/app/actions/orders.ts', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../../backend/src/server.ts', import.meta.url), 'utf8');
const callback = readFileSync(new URL('../src/app/payments/paystack/callback/page.tsx', import.meta.url), 'utf8');

test('online order is created separately from the cash checkout', () => {
  assert.ok(migration.includes('create or replace function public.create_online_order'));
  assert.ok(migration.includes("'online'::public.payment_method, 'pending'::public.payment_status"));
  assert.ok(migration.includes('for update of p'));
  assert.ok(migration.includes('record_paystack_initialization'));
});

test('Paystack secret is used only by a server action and currency is ZAR', () => {
  assert.ok(action.includes('process.env.PAYSTACK_SECRET_KEY'));
  assert.ok(action.includes("currency: 'ZAR'"));
  assert.ok(action.includes('https://api.paystack.co/transaction/initialize'));
  assert.ok(!action.includes('NEXT_PUBLIC_PAYSTACK_SECRET_KEY'));
});

test('webhook verifies raw body signature and verifies the transaction with Paystack', () => {
  assert.ok(backend.includes("parseAs: 'buffer'"));
  assert.ok(backend.includes("createHmac('sha512'"));
  assert.ok(backend.includes('timingSafeEqual'));
  assert.ok(backend.includes('transaction/verify/'));
  assert.ok(backend.includes('finalize_paystack_payment'));
});

test('seller cannot accept an online order before verified payment', () => {
  assert.ok(gate.includes('ONLINE_PAYMENT_NOT_CONFIRMED'));
  assert.ok(gate.includes("p_action in ('accept','ready','complete')"));
  assert.ok(gate.includes("v_order.payment_status <> 'paid'"));
});

test('browser return does not treat a redirect as payment proof', () => {
  assert.ok(callback.includes('Returning to this page does not by itself mean the payment succeeded'));
});

test('Paystack setup errors identify the missing server configuration clearly', () => {
  assert.ok(action.includes("if (!secretKey) return { ok: false, message: 'Paystack is not connected yet."));
  assert.ok(action.includes("if (!siteUrl) return { ok: false, message: 'Online checkout is missing the SpazaLink website address."));
});
