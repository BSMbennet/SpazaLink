import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sellerProcessOrder } from '@/app/actions/seller-orders';
import { createClient } from '@/lib/supabase/server';

type PageProps = { searchParams: Promise<{ notice?: string }> };

const money = (value: number | string) => `R ${Number(value).toFixed(2)}`;

export default async function SellerOrdersPage({ searchParams }: PageProps) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'seller') redirect('/dashboard');

  const { data: orders, error } = await supabase.from('orders')
    .select('id,order_number,status,fulfillment,payment_method,payment_status,subtotal,delivery_fee,platform_fee,total,buyer_note,delivery_address,created_at,shops!inner(name,owner_id),order_items(id,product_name_snapshot,quantity,line_total)')
    .eq('shops.owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const messages: Record<string, string> = {
    updated: 'Order updated successfully.',
    invalid: 'The submitted action was not valid.',
    stale: 'This order has changed. Refresh the page and try again.',
    'cash-not-ready': 'Cash can only be confirmed after collection or delivery is complete.',
    'payment-pending': 'This online order cannot be accepted until Paystack confirms payment.',
    forbidden: 'You do not have permission to update that order.',
    failed: 'The order could not be updated. Please refresh and try again.',
  };

  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="text-link">Dashboard</Link></header>
    <section className="section-heading"><p className="eyebrow">Seller workspace</p><h1>Orders</h1><p className="muted">Accept orders, prepare them, and record cash only after handover.</p></section>
    {notice && messages[notice] && <p className="notice" role="status">{messages[notice]}</p>}
    {error && <p className="notice">Orders could not be loaded. Please refresh.</p>}
    {!error && (!orders || orders.length === 0) && <section className="auth-card"><h2>No orders yet</h2><p className="muted">New customer orders will appear here.</p></section>}
    <section className="dashboard-grid">
      {(orders ?? []).map((order) => {
        const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        return <article className="feature-card" key={order.id}>
          <div className="order-status-row"><span className="status-pill">#{order.order_number} · {order.status}</span><span className="status-pill">{order.payment_status === 'cash_due' ? 'Cash due' : order.payment_status}</span></div>
          <h2>{shop?.name ?? 'Your shop'}</h2>
          <p className="muted-small">{new Date(order.created_at).toLocaleString('en-ZA')} · {order.fulfillment === 'collection' ? 'Collection' : 'Seller delivery'}</p>
          <div className="order-items">{items.map((item) => <div className="order-item" key={item.id}><span>{item.product_name_snapshot} × {item.quantity}</span><strong>{money(item.line_total)}</strong></div>)}</div>
          <div className="checkout-totals">
            <div><span>Order total</span><strong>{money(order.total)}</strong></div>
            <div><span>Platform fee (10%)</span><strong>{money(order.platform_fee)}</strong></div>
            <div><span>Before other costs</span><strong>{money(Number(order.subtotal) - Number(order.platform_fee) + Number(order.delivery_fee))}</strong></div>
          </div>
          {order.delivery_address && <p className="muted-small">Deliver to: {order.delivery_address}</p>}
          {order.buyer_note && <p className="muted-small">Buyer note: {order.buyer_note}</p>}
          <div className="form-actions">
            {order.status === 'placed' && order.payment_method === 'online' && order.payment_status !== 'paid' && <>
              <p className="muted-small">Online payment is not confirmed yet. You cannot accept this order until Paystack verification succeeds.</p>
              <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="reject"/><button className="button button-quiet" type="submit">Reject & restock</button></form>
            </>}
            {order.status === 'placed' && (order.payment_method !== 'online' || order.payment_status === 'paid') && <>
              <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="accept"/><button className="button" type="submit">Accept order</button></form>
              <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="reject"/><button className="button button-quiet" type="submit">Reject</button></form>
            </>}
            {order.status === 'accepted' && <>
              <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="ready"/><button className="button" type="submit">Mark ready</button></form>
              <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="cancel"/><button className="button button-quiet" type="submit">Cancel & restock</button></form>
            </>}
            {order.status === 'ready' && <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="complete"/><button className="button" type="submit">{order.fulfillment === 'collection' ? 'Confirm collected' : 'Confirm delivered'}</button></form>}
            {['collected','delivered'].includes(order.status) && order.payment_method === 'cash' && order.payment_status === 'cash_due' &&
              <form action={sellerProcessOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="action" value="confirm_cash"/><button className="button" type="submit">Confirm cash received</button></form>}
            {order.payment_status === 'cash_confirmed' && <p className="muted-small">Cash receipt recorded.</p>}
          </div>
        </article>;
      })}
    </section>
  </main>;
}
