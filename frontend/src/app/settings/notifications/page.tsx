import Link from 'next/link';
import { redirect } from 'next/navigation';
import { saveWhatsAppConsent } from '@/app/actions/whatsapp';
import { createClient } from '@/lib/supabase/server';

type PageProps = { searchParams: Promise<{ notice?: string }> };

export default async function NotificationSettingsPage({ searchParams }: PageProps) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (error || !userId) redirect('/login');
  const { data: consent } = await supabase.from('whatsapp_consents')
    .select('phone_e164,opted_in,consented_at').eq('user_id', userId).maybeSingle();

  const notices: Record<string,string> = {
    saved: 'Your WhatsApp notification preference was saved.',
    invalid: 'Enter a valid international phone number, for example +27821234567.',
    failed: 'We could not save your preference. Please try again.',
  };

  return <main className="page-shell">
<section className="section-heading"><p className="eyebrow">Notification preferences</p><h1>WhatsApp updates</h1><p className="muted">Choose whether SpazaLink may send you order updates on WhatsApp.</p></section>
    {notice && notices[notice] && <p className="notice" role="status">{notices[notice]}</p>}
    <section className="auth-card auth-card-wide">
      <form action={saveWhatsAppConsent} className="form-stack">
        <label>WhatsApp number in international format<input name="phone" type="tel" placeholder="+27821234567" defaultValue={consent?.phone_e164 ?? ''} maxLength={16}/></label>
        <label className="consent-row"><input name="optedIn" type="checkbox" defaultChecked={consent?.opted_in ?? false}/> I agree to receive transactional order updates from SpazaLink on WhatsApp. I can opt out at any time.</label>
        <p className="muted-small">We use this number only for order-related updates. Marketing messages are not included. Standard WhatsApp/data charges may apply.</p>
        <button className="button button-primary" type="submit">Save WhatsApp preference</button>
      </form>
    </section>
  </main>;
}
