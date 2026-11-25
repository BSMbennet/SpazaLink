import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type PageProps = { searchParams: Promise<{ reference?: string; trxref?: string }> };

export default async function PaystackCallbackPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reference = params.reference ?? params.trxref ?? '';
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) redirect('/login');

  const { data: payment } = reference
    ? await supabase.from('payment_transactions').select('order_id,status').eq('reference', reference).maybeSingle()
    : { data: null };
  if (payment?.status === 'paid') redirect('/orders/' + payment.order_id);

  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/orders" className="text-link">My orders</Link></header>
    <section className="auth-card auth-card-wide">
      <p className="eyebrow">Paystack checkout</p>
      <h1>We are confirming your payment</h1>
      <p className="muted">Please allow a moment for Paystack’s secure server notification and verification to update your order. Returning to this page does not by itself mean the payment succeeded.</p>
      {payment?.order_id && <p><Link href={'/orders/' + payment.order_id} className="text-link">View order status →</Link></p>}
      <p className="muted-small">Reference: {reference || 'Not provided'}</p>
      <p><Link href="/orders" className="button button-secondary">View all orders</Link></p>
    </section>
  </main>;
}
