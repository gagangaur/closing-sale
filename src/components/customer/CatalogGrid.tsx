"use client";

import { useState } from "react";
import { ProductCard } from "@/components/customer/ProductCard";
import type { CatalogProduct, CatalogResult } from "@/lib/types";

/**
 * Product grid with "Load more" pagination. Page 1 is server-rendered data;
 * later pages come from /api/catalog so we never ship the whole catalog.
 */
export function CatalogGrid({
  initial,
  query,
  category,
  sort,
}: {
  initial: CatalogResult;
  query: string;
  category: string;
  sort: string;
}) {
  const [items, setItems] = useState<CatalogProduct[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = items.length < initial.total;

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({
        page: String(page + 1),
        ...(query ? { q: query } : {}),
        ...(category ? { category } : {}),
        ...(sort ? { sort } : {}),
      });
      const res = await fetch(`/api/catalog?${sp.toString()}`);
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as CatalogResult;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.items.filter((p) => !seen.has(p.id))];
      });
      setPage(data.page);
    } catch {
      setError("Could not load more products. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (initial.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-12 text-center">
        <p className="text-3xl">🔍</p>
        <p className="mt-2 font-semibold">No products found</p>
        <p className="mt-1 text-sm text-stone-500">
          Try a different search or category.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} threshold={initial.low_stock_threshold} />
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {error}
        </p>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="h-11 rounded-xl border border-stone-300 bg-white px-8 text-sm font-semibold text-stone-700 shadow-sm disabled:opacity-60"
          >
            {loading ? "Loading…" : `Load more (${initial.total - items.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
