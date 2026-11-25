'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type OrderResult =
  | { ok: true; orderId: string; orderNumber: number; total: number }
  | { ok: false; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function placeCashOrder(formData: FormData): Promise<OrderResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return { ok: false, message: 'Please sign in before placing an order.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'buyer') return { ok: false, message: 'A buyer account is required to place an order.' };

  const shopId = String(formData.get('shopId') ?? '');
  const fulfillment = String(formData.get('fulfillment') ?? '');
  const deliveryAddress = String(formData.get('deliveryAddress') ?? '').trim();
  const buyerNote = String(formData.get('buyerNote') ?? '').trim();
  const rawItems = String(formData.get('items') ?? '');

  if (!uuidPattern.test(shopId) || !['collection', 'seller_delivery'].includes(fulfillment)) {
    return { ok: false, message: 'Your checkout details are not valid. Please review your cart.' };
  }
  if (fulfillment === 'seller_delivery' && (deliveryAddress.length < 4 || deliveryAddress.length > 300)) {
    return { ok: false, message: 'Enter a delivery address between 4 and 300 characters.' };
  }
  if (buyerNote.length > 500 || rawItems.length > 12000) {
    return { ok: false, message: 'Your note or cart is too long. Please shorten it and try again.' };
  }

  let items: Array<{ product_id: string; quantity: number }>;
  try {
    const parsed: unknown = JSON.parse(rawItems);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 30) {
      return { ok: false, message: 'Your cart must contain between 1 and 30 products.' };
    }
    items = parsed.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('Invalid item');
      const value = item as { product_id?: unknown; quantity?: unknown };
      if (typeof value.product_id !== 'string' || !uuidPattern.test(value.product_id) ||
          typeof value.quantity !== 'number' || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 100) {
        throw new Error('Invalid item');
      }
      return { product_id: value.product_id, quantity: value.quantity };
    });
    if (new Set(items.map(item => item.product_id)).size !== items.length) {
      return { ok: false, message: 'Your cart contains duplicate product lines. Please refresh the cart.' };
    }
  } catch {
    return { ok: false, message: 'Your cart could not be read. Please refresh and try again.' };
  }

  const { data, error } = await supabase.rpc('create_cash_order', {
    p_shop_id: shopId,
    p_fulfillment: fulfillment,
    p_delivery_address: fulfillment === 'seller_delivery' ? deliveryAddress : null,
    p_buyer_note: buyerNote || null,
    p_items: items,
  });

  if (error || !data) {
    const detail = error?.message ?? '';
    if (detail.includes('INSUFFICIENT_STOCK')) return { ok: false, message: 'Some items have just sold out or the stock changed. Refresh the marketplace and update your cart.' };
    if (detail.includes('PRODUCT_NOT_AVAILABLE') || detail.includes('SHOP_NOT_AVAILABLE')) return { ok: false, message: 'This shop or one of its products is no longer available.' };
    if (detail.includes('COLLECTION_NOT_AVAILABLE') || detail.includes('SELLER_DELIVERY_NOT_AVAILABLE')) return { ok: false, message: 'This shop does not offer that fulfilment option.' };
    if (detail.includes('BUYER_ACCOUNT_REQUIRED')) return { ok: false, message: 'Please use a buyer account to place this order.' };
    return { ok: false, message: 'We could not place your order. Please try again.' };
  }

  const result = data as { order_id: string; order_number: number; total: number };
  revalidatePath('/marketplace');
  revalidatePath('/orders');
  revalidatePath('/seller/orders');
  return { ok: true, orderId: result.order_id, orderNumber: result.order_number, total: Number(result.total) };
}
