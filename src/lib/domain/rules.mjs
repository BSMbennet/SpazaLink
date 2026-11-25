export const ORDER_TRANSITIONS = Object.freeze({
  placed: ['accepted', 'cancelled'], paid: ['accepted', 'cancelled', 'refunded'],
  accepted: ['ready', 'cancelled'], ready: ['collected', 'delivered', 'cancelled'],
  collected: [], delivered: [], cancelled: ['refunded'], refunded: [],
});
export function isValidOrderTransition(current, next) { return ORDER_TRANSITIONS[current]?.includes(next) ?? false; }
export function calculatePlatformFee(subtotal, percentage = 10) {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new RangeError('Subtotal must be a non-negative number.');
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new RangeError('Fee percentage must be between 0 and 100.');
  return Math.round((subtotal * (percentage / 100) + Number.EPSILON) * 100) / 100;
}
export function canFulfilStock(available, requested) { return Number.isInteger(available) && Number.isInteger(requested) && available >= 0 && requested > 0 && available >= requested; }
export function calculateCreditBalance(entries) {
  return Math.round(entries.reduce((balance, entry) => {
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) throw new RangeError('Credit entry amount must be positive.');
    if (entry.entry_type === 'charge') return balance + entry.amount;
    if (entry.entry_type === 'payment') return balance - entry.amount;
    if (entry.entry_type === 'adjustment') return balance + (entry.direction === 'credit' ? -entry.amount : entry.amount);
    throw new TypeError('Unknown credit entry type.');
  }, 0) * 100) / 100;
}
export function isReviewEligible(orderStatus) { return orderStatus === 'collected' || orderStatus === 'delivered'; }
