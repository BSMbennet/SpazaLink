import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'buyer') redirect('/dashboard');

  const { data: order, error } = await supabase.from('orders')
    .select('id,order_number,status,fulfillment,payment_method,payment_status,subtotal,delivery_fee,platform_fee,total,buyer_note,delivery_address,created_at,shops(name,area,address_text)')
    .eq('id', id).maybeSingle();
  if (error || !order) notFound();

  const { data: items } = await supabase.from('order_items')
    .select('id,product_name_snapshot,unit_price,quantity,line_total')
    .eq('order_id', order.id).order('id');

  const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/orders" className="text-link">All orders</Link></header>
    <section className="section-heading"><p className="eyebrow">Order #{order.order_number}</p><h1>{shop?.name ?? 'Your local order'}</h1><p className="muted">{shop?.area}</p></section>
    <section className="auth-card auth-card-wide">
      <div className="order-status-row"><span className="status-pill">{order.status}</span><span className="status-pill">{order.payment_status === 'cash_due' ? 'Cash due' : order.payment_status}</span></div>
      <p>{order.fulfillment === 'collection' ? 'Collect from the shop' : 'Seller delivery'}</p>
      {order.fulfillment === 'collection' && <p className="muted-small">Collection address: {shop?.address_text}</p>}
      {order.delivery_address && <p className="muted-small">Delivery address: {order.delivery_address}</p>}
      <h2>Items</h2>
      <div className="order-items">{(items ?? []).map(item => <div className="order-item" key={item.id}><span>{item.product_name_snapshot} × {item.quantity}</span><strong>R {Number(item.line_total).toFixed(2)}</strong></div>)}</div>
      <div className="checkout-totals"><div><span>Subtotal</span><strong>R {Number(order.subtotal).toFixed(2)}</strong></div><div><span>Delivery fee</span><strong>R {Number(order.delivery_fee).toFixed(2)}</strong></div><div className="checkout-total"><span>Total</span><strong>R {Number(order.total).toFixed(2)}</strong></div></div>
      {order.payment_method === 'cash' && <p className="notice">Cash has not been confirmed yet. The seller must record receipt of cash before this order is marked paid.</p>}
      {order.buyer_note && <p className="muted-small">Your note: {order.buyer_note}</p>}
      <p className="muted-small">Placed {new Date(order.created_at).toLocaleString('en-ZA')}</p>
    </section>
    <p className="form-foot"><Link href="/marketplace" className="text-link">Continue shopping →</Link></p>
  </main>;
}
