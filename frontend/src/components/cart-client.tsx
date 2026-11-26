'use client';

import { useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { placeCashOrder } from '@/app/actions/orders';
import { useCart } from '@/components/cart-provider';

export function CartClient() {
  const { items, itemCount, subtotal, setQuantity, removeItem, clear } = useCart();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const shop = items[0];
  const total = subtotal;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop || !items.length) return;
    if (items.some(item => item.shop_id !== shop.shop_id)) {
      setMessage('A cart can contain products from one shop only. Remove items from the other shop first.');
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set('shopId', shop.shop_id);
    formData.set('items', JSON.stringify(items.map(item => ({ product_id: item.product_id, quantity: item.quantity }))));
    startTransition(async () => {
      setMessage('');
      formData.set('fulfillment', 'collection');
      const result = await placeCashOrder(formData);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      clear();
      router.push(`/orders/${result.orderId}?placed=1`);
    });
  }

  if (!items.length) return <div className="empty-state"><h2>Your cart is empty.</h2><p>Find products from a local shop and add them here.</p><Link className="button button-primary" href="/marketplace">Browse the marketplace</Link></div>;

  return <div className="cart-layout">
    <section className="cart-lines">
      <p className="eyebrow">One shop per order</p><h2>{shop?.shop_name}</h2>
      {items.map(item => <article className="cart-line" key={item.product_id}>
        <div className="cart-line-copy"><h3>{item.product_name}</h3><p className="muted-small">R {item.price.toFixed(2)} each · {item.available_stock} available</p></div>
        <label className="quantity-control">Qty<input type="number" min="1" max={item.available_stock} step="1" value={item.quantity} onChange={event => setQuantity(item.product_id, Number(event.target.value))}/></label>
        <strong>R {(item.price * item.quantity).toFixed(2)}</strong>
        <button className="text-button" type="button" onClick={() => removeItem(item.product_id)}>Remove</button>
      </article>)}
      <p className="muted-small">{itemCount} item{itemCount === 1 ? '' : 's'} in your cart. Prices and stock are checked again when you place the order.</p>
    </section>
    <section className="auth-card cart-checkout">
      <h2>Checkout</h2>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted-small">Pilot orders are for collection from the shop only.</p>
        <input type="hidden" name="fulfillment" value="collection"/>
        <label>Note to seller (optional)<textarea name="buyerNote" maxLength={500} rows={2} placeholder="Any useful order details"/></label>
        <p className="muted-small">Payment: cash when you collect your order. The seller confirms cash received after handover.</p>
        <div className="checkout-totals"><div><span>Items subtotal</span><strong>R {subtotal.toFixed(2)}</strong></div><div className="checkout-total"><span>Total due</span><strong>R {total.toFixed(2)}</strong></div></div>
        <p className="muted-small">Cash is not marked as paid until the seller confirms receipt.</p>
        {message && <p className="notice" role="alert">{message}</p>}
        <button className="button button-primary" type="submit" disabled={pending || !shop?.offers_collection}>{pending ? 'Placing order…' : 'Place cash order'}</button>
      </form>
    </section>
  </div>;
}
