"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartContext";

/** Sticky header bucket button with live item count. */
export function CartBadge() {
  const { itemCount, hydrated } = useCart();
  return (
    <Link
      href="/bucket"
      aria-label={`Open bucket, ${itemCount} items`}
      className="relative flex items-center gap-1.5 rounded-full bg-sale px-4 py-2 text-sm font-semibold text-white shadow-sm active:scale-95 transition-transform"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      Bucket
      {hydrated && itemCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-deal px-1 text-xs font-bold text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}
