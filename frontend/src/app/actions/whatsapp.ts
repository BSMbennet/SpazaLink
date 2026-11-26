'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function saveWhatsAppConsent(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');

  const optedIn = formData.get('optedIn') === 'on';
  const phone = String(formData.get('phone') ?? '').trim();
  if (optedIn && !/^[+][1-9][0-9]{7,14}$/.test(phone)) {
    redirect('/settings/notifications?notice=invalid');
  }
  const { error: saveError } = await supabase.rpc('set_whatsapp_consent', {
    p_phone_e164: optedIn ? phone : null,
    p_opted_in: optedIn,
  });
  if (saveError) redirect('/settings/notifications?notice=failed');
  revalidatePath('/settings/notifications');
  redirect('/settings/notifications?notice=saved');
}
