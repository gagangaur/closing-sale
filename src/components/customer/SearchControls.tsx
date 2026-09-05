"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { Category } from "@/lib/types";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popularity", label: "Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
] as const;

/** Search bar + category chips + sort. State lives in the URL. */
export function SearchControls({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const urlQuery = params.get("q") ?? "";
  const activeCategory = params.get("category") ?? "";
  const activeSort = params.get("sort") ?? "newest";

  const [text, setText] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep the input in sync when the URL changes externally (back button)
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setText(urlQuery);
  }

  function pushParams(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    startTransition(() => {
      router.replace(`/?${sp.toString()}`, { scroll: false });
    });
  }

  function onSearchChange(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value.trim() }), 350);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={text}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search products, categories…"
          aria-label="Search products"
          className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-11 pr-4 text-base shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
        />
      </div>

      <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => pushParams({ category: "" })}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
            activeCategory === ""
              ? "border-navy bg-navy text-white"
              : "border-stone-300 bg-white text-stone-700"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() =>
              pushParams({ category: activeCategory === c.slug ? "" : c.slug })
            }
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              activeCategory === c.slug
                ? "border-navy bg-navy text-white"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {c.name}
          </button>
        ))}
        <label className="ml-auto shrink-0">
          <span className="sr-only">Sort products</span>
          <select
            value={activeSort}
            onChange={(e) => pushParams({ sort: e.target.value })}
            className="h-8 rounded-full border border-stone-300 bg-white px-2.5 text-sm font-medium text-stone-700"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
