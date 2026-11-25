'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { placeCashOrder } from '@/app/actions/orders';
import { useCart } from '@/components/cart-provider';

export function CartClient() {
  const { items, itemCount, subtotal, ready, setQuantity, removeItem, clear } = useCart();
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<'collection' | 'seller_delivery'>('collection');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const shop = items[0];
  const deliveryFee = fulfillment === 'seller_delivery' ? Number(shop?.delivery_fee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  useEffect(() => {
    if (ready && shop && !shop.offers_collection && shop.offers_delivery) setFulfillment('seller_delivery');
  }, [ready, shop]);

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
      const result = await placeCashOrder(formData);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      clear();
      router.push(`/orders/${result.orderId}?placed=1`);
    });
  }

  if (!ready) return <p className="empty-state">Loading your cart…</p>;
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
        <fieldset><legend>How will you receive your order?</legend>
          {shop?.offers_collection && <label className="consent-row"><input type="radio" name="fulfillment" value="collection" checked={fulfillment === 'collection'} onChange={() => setFulfillment('collection')}/> Collect from the shop</label>}
          {shop?.offers_delivery && <label className="consent-row"><input type="radio" name="fulfillment" value="seller_delivery" checked={fulfillment === 'seller_delivery'} onChange={() => setFulfillment('seller_delivery')}/> Delivery by the seller (R {Number(shop.delivery_fee).toFixed(2)})</label>}
        </fieldset>
        {fulfillment === 'seller_delivery' && <label>Delivery address<textarea name="deliveryAddress" required minLength={4} maxLength={300} rows={3} placeholder="Street, area and delivery instructions"/></label>}
        <label>Note to seller (optional)<textarea name="buyerNote" maxLength={500} rows={2} placeholder="Any useful order details"/></label>
        <div className="checkout-totals"><div><span>Items subtotal</span><strong>R {subtotal.toFixed(2)}</strong></div><div><span>Delivery fee</span><strong>R {deliveryFee.toFixed(2)}</strong></div><div className="checkout-total"><span>Total due in cash</span><strong>R {total.toFixed(2)}</strong></div></div>
        <p className="muted-small">This order is cash due. It is not marked as paid until the seller confirms receipt of cash.</p>
        {message && <p className="notice" role="alert">{message}</p>}
        <button className="button button-primary" type="submit" disabled={pending || !shop?.offers_collection && !shop?.offers_delivery}>{pending ? 'Placing order…' : 'Place cash order'}</button>
      </form>
    </section>
  </div>;
}
