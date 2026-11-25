'use client';

import Link from 'next/link';
import { useCart } from '@/components/cart-provider';

export function CartLink() {
  const { itemCount } = useCart();
  return <Link href="/cart" className="button button-quiet">Cart ({itemCount})</Link>;
}
