'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedActions = new Set(['accept', 'reject', 'ready', 'complete', 'confirm_cash', 'cancel']);

export async function sellerProcessOrder(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'seller') redirect('/dashboard');

  const orderId = String(formData.get('orderId') ?? '');
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) ||
      !allowedActions.has(action) || note.length > 300) {
    redirect('/seller/orders?notice=invalid');
  }

  const { error } = await supabase.rpc('seller_process_order', {
    p_order_id: orderId,
    p_action: action,
    p_note: note || null,
  });
  if (error) {
    const message = error.message.includes('INVALID_ORDER_STATE_TRANSITION') ? 'stale' :
      error.message.includes('CASH_CONFIRMATION_NOT_ALLOWED') ? 'cash-not-ready' :
      error.message.includes('SELLER_ACCESS_REQUIRED') ? 'forbidden' : 'failed';
    redirect('/seller/orders?notice=' + message);
  }

  revalidatePath('/seller/orders');
  revalidatePath('/orders');
  revalidatePath('/orders/' + orderId);
  redirect('/seller/orders?notice=updated');
}
