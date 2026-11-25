import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCreditBalance, calculatePlatformFee, canFulfilStock, isReviewEligible, isValidOrderTransition } from '../src/lib/domain/rules.mjs';
test('order states only allow intended forward transitions', () => {
  assert.equal(isValidOrderTransition('placed', 'accepted'), true);
  assert.equal(isValidOrderTransition('accepted', 'ready'), true);
  assert.equal(isValidOrderTransition('ready', 'collected'), true);
  assert.equal(isValidOrderTransition('collected', 'accepted'), false);
  assert.equal(isValidOrderTransition('placed', 'delivered'), false);
});
test('platform fee is 10 percent of product subtotal and rounded to cents', () => {
  assert.equal(calculatePlatformFee(100), 10); assert.equal(calculatePlatformFee(49.99), 5);
  assert.equal(calculatePlatformFee(100, 0), 0); assert.throws(() => calculatePlatformFee(-1), RangeError);
});
test('stock check rejects requests that exceed available stock', () => {
  assert.equal(canFulfilStock(3, 2), true); assert.equal(canFulfilStock(1, 2), false); assert.equal(canFulfilStock(0, 1), false);
});
test('credit book totals subtract payments from charges', () => {
  assert.equal(calculateCreditBalance([{ entry_type: 'charge', amount: 100 }, { entry_type: 'charge', amount: 25.5 }, { entry_type: 'payment', amount: 40 }]), 85.5);
  assert.equal(calculateCreditBalance([{ entry_type: 'charge', amount: 100 }, { entry_type: 'adjustment', direction: 'credit', amount: 10 }]), 90);
});
test('only completed collection or delivery orders can be reviewed', () => {
  assert.equal(isReviewEligible('collected'), true); assert.equal(isReviewEligible('delivered'), true); assert.equal(isReviewEligible('ready'), false);
});
