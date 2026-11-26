import { redirect } from 'next/navigation';
import { CartClient } from '@/components/cart-client';
import { createClient } from '@/lib/supabase/server';

export default async function CartPage() {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || !userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();

  return <main className="page-shell">
<section className="section-heading"><p className="eyebrow">Your order</p><h1>Shopping cart</h1><p className="muted">Each order goes to one local seller.</p></section>
    {profile?.role !== 'buyer'
      ? <p className="notice">Please use a buyer account to place orders. Seller accounts can browse the marketplace but cannot check out.</p>
      : <CartClient/>}
  </main>;
}
