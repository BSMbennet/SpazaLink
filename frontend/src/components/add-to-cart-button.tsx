'use client';

import { useState } from 'react';
import { useCart } from '@/components/cart-provider';

type Props = {
  productId: string;
  productName: string;
  price: number;
  stock: number;
  shopId: string;
  shopName: string;
  deliveryFee: number;
  offersCollection: boolean;
  offersDelivery: boolean;
};

export function AddToCartButton({ productId, productName, price, stock, shopId, shopName, deliveryFee, offersCollection, offersDelivery }: Props) {
  const { addItem, ready } = useCart();
  const [message, setMessage] = useState('');
  function add() {
    const added = addItem({
      product_id: productId,
      shop_id: shopId,
      shop_name: shopName,
      product_name: productName,
      price,
      quantity: 1,
      available_stock: stock,
      delivery_fee: deliveryFee,
      offers_collection: offersCollection,
      offers_delivery: offersDelivery,
    });
    setMessage(added ? 'Added to cart' : 'Your cart already has items from another shop. Finish or clear that cart first.');
  }
  return <div className="add-cart-control"><button className="button button-primary" type="button" disabled={!ready || stock < 1} onClick={add}>Add to cart</button>{message && <p className="muted-small" role="status">{message}</p>}</div>;
}
