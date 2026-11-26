import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ id: string }> };

const eventLabel: Record<string, string> = {
  accepted: 'Seller accepted the order',
  rejected: 'Seller rejected the order',
  ready: 'Order is ready',
  completed: 'Order handed over',
  cancelled: 'Order cancelled',
  cash_confirmed: 'Seller confirmed cash received',
};

function orderStatusLabel(status: string, fulfillment: string): string {
  if (status === 'placed') return 'Awaiting seller';
  if (status === 'accepted') return 'Confirmed by seller';
  if (status === 'ready') return fulfillment === 'collection' ? 'Ready for collection' : 'Ready for delivery';
  if (status === 'collected') return 'Collected';
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'refunded') return 'Refunded';
  return status;
}

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

  const [{ data: items }, { data: events }] = await Promise.all([
    supabase.from('order_items').select('id,product_name_snapshot,unit_price,quantity,line_total').eq('order_id', order.id).order('id'),
    supabase.from('order_events').select('id,event_type,from_status,to_status,note,created_at').eq('order_id', order.id).order('created_at', { ascending: true }),
  ]);
  const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  return <main className="page-shell">
<section className="section-heading"><p className="eyebrow">Order #{order.order_number}</p><h1>{shop?.name ?? 'Your local order'}</h1><p className="muted">{shop?.area}</p></section>
    <section className="auth-card auth-card-wide">
      <div className="order-status-row"><span className="status-pill">{orderStatusLabel(order.status, order.fulfillment)}</span><span className="status-pill">{order.payment_status === 'cash_due' ? 'Cash due' : order.payment_status}</span></div>
      <p>{order.fulfillment === 'collection' ? 'Collect from the shop' : 'Seller delivery'}</p>
      {order.fulfillment === 'collection' && <p className="muted-small">Collection address: {shop?.address_text}</p>}
      {order.delivery_address && <p className="muted-small">Delivery address: {order.delivery_address}</p>}
      <h2>Order progress</h2>
      {(events ?? []).length === 0 ? <p className="muted-small">Waiting for the seller to review your order.</p> :
        <ol className="request-list">{events!.map((event) => <li key={event.id}><strong>{event.event_type === 'completed' ? (order.fulfillment === 'collection' ? 'Order collected' : 'Order delivered') : eventLabel[event.event_type] ?? event.to_status}</strong><span className="muted-small"> · {new Date(event.created_at).toLocaleString('en-ZA')}</span>{event.note && <p className="muted-small">{event.note}</p>}</li>)}</ol>}
      <h2>Items</h2>
      <div className="order-items">{(items ?? []).map(item => <div className="order-item" key={item.id}><span>{item.product_name_snapshot} × {item.quantity}</span><strong>R {Number(item.line_total).toFixed(2)}</strong></div>)}</div>
      <div className="checkout-totals"><div><span>Subtotal</span><strong>R {Number(order.subtotal).toFixed(2)}</strong></div><div><span>Delivery fee</span><strong>R {Number(order.delivery_fee).toFixed(2)}</strong></div><div className="checkout-total"><span>Total</span><strong>R {Number(order.total).toFixed(2)}</strong></div></div>
      {order.payment_method === 'cash' && <p className="notice">{order.payment_status === 'cash_confirmed' ? 'The seller confirmed receipt of your cash payment.' : 'Cash has not been confirmed yet. The seller must record receipt of cash before this order is marked paid.'}</p>}
      {order.buyer_note && <p className="muted-small">Your note: {order.buyer_note}</p>}
      <p className="muted-small">Placed {new Date(order.created_at).toLocaleString('en-ZA')}</p>
    </section>
    <p className="form-foot"><Link href="/marketplace" className="text-link">Continue shopping →</Link></p>
  </main>;
}
