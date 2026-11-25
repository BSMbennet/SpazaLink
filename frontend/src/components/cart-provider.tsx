'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CartItem = {
  product_id: string;
  shop_id: string;
  shop_name: string;
  product_name: string;
  price: number;
  quantity: number;
  available_stock: number;
  delivery_fee: number;
  offers_collection: boolean;
  offers_delivery: boolean;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  ready: boolean;
  addItem: (item: CartItem) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'spazalink-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed.filter(item =>
          typeof item.product_id === 'string' &&
          typeof item.shop_id === 'string' &&
          Number.isFinite(item.price) &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0
        ).map(item => ({ ...item, delivery_fee: Number(item.delivery_fee ?? 0), offers_collection: item.offers_collection ?? true, offers_delivery: item.offers_delivery ?? false })));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    ready,
    addItem: (item) => {
      if (!ready || (items.length > 0 && items[0].shop_id !== item.shop_id)) return false;
      setItems(current => {
        const existing = current.find(line => line.product_id === item.product_id);
        if (existing) return current.map(line => line.product_id === item.product_id
          ? { ...line, quantity: Math.min(line.quantity + item.quantity, item.available_stock), available_stock: item.available_stock }
          : line);
        return [...current, item];
      });
      return true;
    },
    setQuantity: (productId, quantity) => {
      setItems(current => current.map(item => item.product_id === productId
        ? { ...item, quantity: Math.max(1, Math.min(Math.floor(quantity), item.available_stock)) }
        : item));
    },
    removeItem: (productId) => setItems(current => current.filter(item => item.product_id !== productId)),
    clear: () => setItems([]),
  }), [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
