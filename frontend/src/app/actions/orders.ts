'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requestWhatsAppOrderNotice } from '@/lib/whatsapp';

type OrderResult =
  | { ok: true; orderId: string; orderNumber: number; total: number }
  | { ok: false; message: string };

const PILOT_ONLINE_PAYMENTS_ENABLED = false;

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

  if (!uuidPattern.test(shopId) || fulfillment !== 'collection') {
    return { ok: false, message: 'Your checkout details are not valid. Please review your cart.' };
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
    p_fulfillment: 'collection',
    p_delivery_address: null,
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
  await requestWhatsAppOrderNotice(supabase, result.order_id, 'Order placed — cash payment due');
  revalidatePath('/marketplace');
  revalidatePath('/orders');
  revalidatePath('/seller/orders');
  return { ok: true, orderId: result.order_id, orderNumber: result.order_number, total: Number(result.total) };
}



export async function startPaystackOrder(formData: FormData): Promise<
  | { ok: true; checkoutUrl: string }
  | { ok: false; message: string }
> {
  if (!PILOT_ONLINE_PAYMENTS_ENABLED) return { ok: false, message: 'Online payments are paused during the pilot. Please choose cash when collecting your order.' };
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!secretKey) return { ok: false, message: 'Paystack is not connected yet. Online payment is temporarily unavailable. Please choose cash.' };
  if (!siteUrl) return { ok: false, message: 'Online checkout is missing the SpazaLink website address. Please contact support or choose cash for now.' };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const email = claimsData?.claims?.email;
  if (claimsError || !userId) return { ok: false, message: 'Please sign in before placing an order.' };
  if (typeof email !== 'string' || !email.includes('@')) return { ok: false, message: 'Add a valid email address to your account before paying online.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'buyer') return { ok: false, message: 'A buyer account is required to place an order.' };

  const shopId = String(formData.get('shopId') ?? '');
  const fulfillment = String(formData.get('fulfillment') ?? '');
  const deliveryAddress = String(formData.get('deliveryAddress') ?? '').trim();
  const buyerNote = String(formData.get('buyerNote') ?? '').trim();
  const rawItems = String(formData.get('items') ?? '');
  if (!uuidPattern.test(shopId) || !['collection', 'seller_delivery'].includes(fulfillment)) return { ok: false, message: 'Your checkout details are not valid.' };
  if (fulfillment === 'seller_delivery' && (deliveryAddress.length < 4 || deliveryAddress.length > 300)) return { ok: false, message: 'Enter a valid delivery address.' };
  if (buyerNote.length > 500 || rawItems.length > 12000) return { ok: false, message: 'Your note or cart is too long.' };

  let items: Array<{ product_id: string; quantity: number }>;
  try {
    const parsed: unknown = JSON.parse(rawItems);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 30) throw new Error('Invalid items');
    items = parsed.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('Invalid item');
      const value = item as { product_id?: unknown; quantity?: unknown };
      if (typeof value.product_id !== 'string' || !uuidPattern.test(value.product_id) ||
          typeof value.quantity !== 'number' || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 100) throw new Error('Invalid item');
      return { product_id: value.product_id, quantity: value.quantity };
    });
    if (new Set(items.map(item => item.product_id)).size !== items.length) throw new Error('Duplicate products');
  } catch {
    return { ok: false, message: 'Your cart could not be read. Refresh and try again.' };
  }

  const { data: orderData, error: orderError } = await supabase.rpc('create_online_order', {
    p_shop_id: shopId,
    p_fulfillment: fulfillment,
    p_delivery_address: fulfillment === 'seller_delivery' ? deliveryAddress : null,
    p_buyer_note: buyerNote || null,
    p_items: items,
  });
  if (orderError || !orderData) {
    if (orderError?.message.includes('INSUFFICIENT_STOCK')) return { ok: false, message: 'Some items have just sold out. Refresh your cart.' };
    return { ok: false, message: 'We could not create your order. Please review your cart and try again.' };
  }

  const order = orderData as { order_id: string; order_number: number; total: number };
  const amountMinor = Math.round(Number(order.total) * 100);
  const reference = 'spz' + crypto.randomUUID().replaceAll('-', '');
  const { error: recordError } = await supabase.rpc('record_paystack_initialization', {
    p_order_id: order.order_id,
    p_reference: reference,
    p_amount_minor: amountMinor,
  });
  if (recordError) return { ok: false, message: 'Order #' + order.order_number + ' was created but payment setup failed. Please contact support.' };

  let response: Response;
  try {
    response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: amountMinor,
        currency: 'ZAR',
        reference,
        callback_url: siteUrl.replace(/\/$/, '') + '/payments/paystack/callback',
        metadata: { order_id: order.order_id, order_number: order.order_number, platform: 'SpazaLink' },
      }),
      cache: 'no-store',
      // Do not let a slow Paystack hang checkout.
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, message: 'Paystack could not be reached. Order #' + order.order_number + ' is pending payment; please contact support before retrying.' };
  }
  // A gateway error can return a web page instead of JSON, so read it safely.
  const payload = await response.json().catch(() => ({})) as { status?: boolean; data?: { authorization_url?: string } };
  const checkoutUrl = payload.data?.authorization_url;
  if (!response.ok || !payload.status || !checkoutUrl || !checkoutUrl.startsWith('https://checkout.paystack.com/')) {
    return { ok: false, message: 'Paystack could not start checkout. Order #' + order.order_number + ' is pending payment.' };
  }
  return { ok: true, checkoutUrl };
}
