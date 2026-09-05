"use client";

import { useCart } from "@/components/cart/CartContext";
import type { CatalogProduct } from "@/lib/types";

/**
 * "Add" button that turns into a quantity stepper once the item is in the
 * bucket. Caps at the available quantity known to the client — the server
 * re-validates atomically at order time.
 */
export function AddToBucket({
  product,
  size = "sm",
}: {
  product: CatalogProduct;
  size?: "sm" | "lg";
}) {
  const { addItem, setQuantity, getQuantity, hydrated } = useCart();
  const qty = hydrated ? getQuantity(product.id) : 0;
  const outOfStock = product.available_qty <= 0;
  const atMax = qty >= product.available_qty;

  const btnBase =
    size === "lg"
      ? "h-12 text-base font-semibold"
      : "h-9 text-sm font-semibold";

  if (outOfStock) {
    return (
      <button
        disabled
        className={`${btnBase} w-full cursor-not-allowed rounded-lg bg-stone-200 text-stone-500`}
      >
        Out of stock
      </button>
    );
  }

  if (qty === 0) {
    return (
      <button
        onClick={() => addItem(product, 1)}
        className={`${btnBase} w-full rounded-lg bg-cta text-white shadow-sm transition-transform active:scale-95`}
      >
        Add to bucket
      </button>
    );
  }

  return (
    <div
      className={`${size === "lg" ? "h-12" : "h-9"} flex w-full items-stretch overflow-hidden rounded-lg border-2 border-cta`}
    >
      <button
        aria-label={`Decrease quantity of ${product.name}`}
        onClick={() => setQuantity(product.id, qty - 1)}
        className="flex-1 bg-cta-soft text-lg font-bold text-cta active:bg-green-100"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="flex flex-1 items-center justify-center text-sm font-bold"
      >
        {qty}
      </span>
      <button
        aria-label={`Increase quantity of ${product.name}`}
        onClick={() => addItem(product, 1)}
        disabled={atMax}
        className="flex-1 bg-cta-soft text-lg font-bold text-cta active:bg-green-100 disabled:cursor-not-allowed disabled:text-stone-300"
      >
        +
      </button>
    </div>
  );
}
