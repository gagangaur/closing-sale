"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, CatalogProduct, OfferTier } from "@/lib/types";

const STORAGE_KEY = "closing-sale-bucket-v1";
const MAX_QTY_PER_ITEM = 999;

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (product: CatalogProduct, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  getQuantity: (productId: string) => number;
  /** Highest tier the current subtotal qualifies for (with gift in stock). */
  eligibleTier: (tiers: OfferTier[]) => OfferTier | null;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // The bucket is a convenience only — the database is the source of truth
  // for every order. localStorage just survives page reloads.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          // One-time hydration from localStorage after mount: the server
          // renders an empty bucket, so reading storage during render would
          // cause a hydration mismatch. This runs exactly once.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(
            parsed.filter(
              (i) =>
                typeof i?.id === "string" &&
                typeof i?.selling_price === "number" &&
                Number.isInteger(i?.quantity) &&
                i.quantity > 0
            )
          );
        }
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage full/unavailable — cart still works in memory
    }
  }, [items, hydrated]);

  const addItem = useCallback((product: CatalogProduct, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      const cap = Math.min(product.available_qty, MAX_QTY_PER_ITEM);
      if (existing) {
        const next = Math.min(existing.quantity + qty, cap);
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: next } : i));
      }
      if (cap < 1) return prev;
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          image_url: product.image_url,
          mrp: product.mrp,
          selling_price: product.selling_price,
          discount_pct: product.discount_pct,
          available_qty: product.available_qty,
          quantity: Math.min(qty, cap),
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId: string, qty: number) => {
    setItems((prev) => {
      if (qty < 1) return prev.filter((i) => i.id !== productId);
      return prev.map((i) =>
        i.id === productId
          ? {
              ...i,
              quantity: Math.min(qty, Math.min(i.available_qty, MAX_QTY_PER_ITEM)),
            }
          : i
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const getQuantity = useCallback(
    (productId: string) => items.find((i) => i.id === productId)?.quantity ?? 0,
    [items]
  );

  const subtotal = useMemo(
    () =>
      Math.round(
        items.reduce((sum, i) => sum + i.selling_price * i.quantity, 0) * 100
      ) / 100,
    [items]
  );

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const eligibleTier = useCallback(
    (tiers: OfferTier[]): OfferTier | null => {
      const qualifying = tiers
        .filter((t) => t.in_stock && t.threshold <= subtotal)
        .sort((a, b) => b.threshold - a.threshold);
      return qualifying[0] ?? null;
    },
    [subtotal]
  );

  const value = useMemo(
    () => ({
      items,
      hydrated,
      itemCount,
      subtotal,
      addItem,
      setQuantity,
      removeItem,
      clear,
      getQuantity,
      eligibleTier,
    }),
    [items, hydrated, itemCount, subtotal, addItem, setQuantity, removeItem, clear, getQuantity, eligibleTier]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
