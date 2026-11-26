import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cart = readFileSync(new URL('../src/components/cart-client.tsx', import.meta.url), 'utf8');
const ordersAction = readFileSync(new URL('../src/app/actions/orders.ts', import.meta.url), 'utf8');
const sellerShop = readFileSync(new URL('../src/app/seller/shop/page.tsx', import.meta.url), 'utf8');
const sellerAction = readFileSync(new URL('../src/app/actions/seller.ts', import.meta.url), 'utf8');
const sellerOrders = readFileSync(new URL('../src/app/seller/orders/page.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase/migrations/20261126175600_pilot_cash_collection_zero_fee.sql', import.meta.url), 'utf8');

test('buyer checkout offers cash on collection only', () => {
  assert.match(cart, /Pilot orders are for collection from the shop only/);
  assert.match(cart, /Payment: cash when you collect your order/);
  assert.match(cart, /placeCashOrder\(formData\)/);
  assert.doesNotMatch(cart, /Paystack|seller_delivery|deliveryAddress/);
});

test('server action rejects delivery and always creates a collection cash order', () => {
  assert.match(ordersAction, /fulfillment !== 'collection'/);
  assert.match(ordersAction, /p_fulfillment: 'collection'/);
  assert.match(ordersAction, /p_delivery_address: null/);
});

test('online payment action is disabled for the supervised pilot', () => {
  assert.match(ordersAction, /const PILOT_ONLINE_PAYMENTS_ENABLED = false/);
  assert.match(ordersAction, /if \(!PILOT_ONLINE_PAYMENTS_ENABLED\) return/);
});

test('seller cannot re-enable delivery through a forged form submission', () => {
  assert.match(sellerShop, /Seller delivery and online payments are paused/);
  assert.match(sellerAction, /const offersCollection = true/);
  assert.match(sellerAction, /const offersDelivery = false/);
  assert.match(sellerAction, /const deliveryFee = 0/);
});

test('seller fee display no longer hardcodes 10 percent', () => {
  assert.doesNotMatch(sellerOrders, /Platform fee \(10%\)/);
  assert.match(sellerOrders, /New pilot orders have a 0% SpazaLink fee/);
});

test('database migration sets existing shops to zero fee and collection-only', () => {
  assert.match(migration, /set platform_fee_percent = 0/i);
  assert.match(migration, /offers_collection = true/i);
  assert.match(migration, /offers_delivery = false/i);
  assert.match(migration, /shops_pilot_zero_platform_fee_check/i);
  assert.match(migration, /shops_pilot_collection_only_check/i);
});

test('database migration disables authenticated direct online order creation', () => {
  assert.match(migration, /revoke all on function public\.create_online_order[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.record_paystack_initialization[\s\S]*from public, anon, authenticated/i);
});
