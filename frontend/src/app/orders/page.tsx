import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'buyer') redirect('/dashboard');

  const { data: orders, error } = await supabase.from('orders')
    .select('id,order_number,status,fulfillment,payment_method,payment_status,total,created_at,shops(name,area)')
    .order('created_at', { ascending: false }).limit(50);

  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/marketplace" className="text-link">Shop more</Link></header>
    <section className="section-heading"><p className="eyebrow">Buyer account</p><h1>Your orders</h1><p className="muted">Track your local shop orders here.</p></section>
    {error ? <p className="notice">Your orders could not be loaded. Please try again.</p> : orders?.length ? <div className="order-list">{orders.map(order => {
      const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
      return <article className="order-card" key={order.id}>
        <div><p className="eyebrow">Order #{order.order_number}</p><h2>{shop?.name ?? 'Local shop'}</h2><p className="muted-small">{new Date(order.created_at).toLocaleString('en-ZA')} · {order.fulfillment === 'collection' ? 'Collection' : 'Seller delivery'}</p></div>
        <div className="order-card-side"><strong>R {Number(order.total).toFixed(2)}</strong><span className="status-pill">{order.status}</span><Link className="text-link" href={`/orders/${order.id}`}>View order →</Link></div>
      </article>;
    })}</div> : <div className="empty-state"><h2>No orders yet.</h2><p>Your placed orders will appear here.</p><Link href="/marketplace" className="button button-primary">Browse shops</Link></div>}
  </main>;
}
