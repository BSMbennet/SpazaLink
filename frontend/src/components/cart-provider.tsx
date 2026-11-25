'use client';

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

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
  addItem: (item: CartItem) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'spazalink-cart-v1';
const EMPTY_CART: CartItem[] = [];
const CART_EVENT = 'spazalink-cart-changed';
let cachedSerialized: string | null | undefined;
let cachedItems: CartItem[] = EMPTY_CART;

function parseCart(raw: string | null): CartItem[] {
  if (!raw) return EMPTY_CART;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY_CART;
    return parsed.filter((item): item is CartItem =>
      Boolean(item) &&
      typeof item.product_id === 'string' &&
      typeof item.shop_id === 'string' &&
      typeof item.shop_name === 'string' &&
      typeof item.product_name === 'string' &&
      Number.isFinite(item.price) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      Number.isInteger(item.available_stock) &&
      item.available_stock >= 0
    ).map(item => ({
      ...item,
      delivery_fee: Number(item.delivery_fee ?? 0),
      offers_collection: item.offers_collection ?? true,
      offers_delivery: item.offers_delivery ?? false,
    }));
  } catch {
    return EMPTY_CART;
  }
}

function getCartSnapshot(): CartItem[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedSerialized) {
    cachedSerialized = raw;
    cachedItems = parseCart(raw);
  }
  return cachedItems;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CART_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CART_EVENT, callback);
  };
}

function updateCart(updater: (current: CartItem[]) => CartItem[]) {
  const next = updater(getCartSnapshot());
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedSerialized = raw;
  cachedItems = next;
  window.dispatchEvent(new Event(CART_EVENT));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getCartSnapshot, getServerSnapshot);
  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    addItem: (item) => {
      const current = getCartSnapshot();
      if (current.length > 0 && current[0].shop_id !== item.shop_id) return false;
      updateCart(lines => {
        const existing = lines.find(line => line.product_id === item.product_id);
        if (existing) return lines.map(line => line.product_id === item.product_id
          ? { ...line, quantity: Math.min(line.quantity + item.quantity, item.available_stock), available_stock: item.available_stock }
          : line);
        return [...lines, item];
      });
      return true;
    },
    setQuantity: (productId, quantity) => updateCart(lines => lines.map(item => item.product_id === productId
      ? { ...item, quantity: Math.max(1, Math.min(Math.floor(quantity) || 1, item.available_stock || 1)) }
      : item)),
    removeItem: (productId) => updateCart(lines => lines.filter(item => item.product_id !== productId)),
    clear: () => updateCart(() => []),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
