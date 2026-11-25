import type { SupabaseClient } from '@supabase/supabase-js';

export async function requestWhatsAppOrderNotice(
  supabase: SupabaseClient,
  orderId: string,
  event: string,
): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  try {
    await fetch(apiUrl.replace(/\\/$/, '') + '/v1/notifications/whatsapp/order', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, event }),
      cache: 'no-store',
    });
  } catch {
    // Messaging is best-effort and must never block order processing.
  }
}
