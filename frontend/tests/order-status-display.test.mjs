import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const buyerList = readFileSync(new URL('../src/app/orders/page.tsx', import.meta.url), 'utf8');
const buyerDetail = readFileSync(new URL('../src/app/orders/[id]/page.tsx', import.meta.url), 'utf8');
const sellerOrders = readFileSync(new URL('../src/app/seller/orders/page.tsx', import.meta.url), 'utf8');

test('buyer and seller order lists show a clear collected status', () => {
  assert.match(buyerList, /status === 'collected'\) return 'Collected'/);
  assert.match(sellerOrders, /status === 'collected'\) return 'Collected'/);
});

test('buyer order detail labels collection and delivery completion separately', () => {
  assert.match(buyerDetail, /order\.fulfillment === 'collection' \? 'Order collected' : 'Order delivered'/);
  assert.match(buyerDetail, /status === 'collected'\) return 'Collected'/);
});

test('order screens display seller confirmation and ready states in plain language', () => {
  assert.match(buyerList, /Confirmed by seller/);
  assert.match(buyerDetail, /Confirmed by seller/);
  assert.match(sellerOrders, /status === 'accepted'\) return 'Confirmed'/);
  assert.match(sellerOrders, /Ready for collection/);
});
