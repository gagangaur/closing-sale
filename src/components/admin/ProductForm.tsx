"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  adjustInventory,
  saveProduct,
  setProductActive,
  setProductArchived,
  uploadProductImage,
} from "@/app/admin/(dashboard)/actions";
import { formatINR } from "@/lib/format";
import type { Category } from "@/lib/types";

export type ProductFormInitial = {
  id: string;
  name: string;
  description: string;
  category_id: string | null;
  image_url: string | null;
  mrp: number;
  selling_price: number;
  active: boolean;
  archived: boolean;
  tags: string[];
  total_qty: number;
  reserved_qty: number;
  available_qty: number;
} | null;

const inputCls =
  "h-11 w-full rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20";

export function ProductForm({
  categories,
  initial,
}: {
  categories: Category[];
  initial: ProductFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [mrp, setMrp] = useState(initial ? String(initial.mrp) : "");
  const [priceMode, setPriceMode] = useState<"price" | "discount">("price");
  const [price, setPrice] = useState(initial ? String(initial.selling_price) : "");
  const [discount, setDiscount] = useState("");
  const [active, setActive] = useState(initial?.active ?? true);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [initialStock, setInitialStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // MRP + selling price OR MRP + discount% — the system derives the other
  const mrpNum = Number(mrp);
  const derived = useMemo(() => {
    if (!Number.isFinite(mrpNum) || mrpNum <= 0) return null;
    if (priceMode === "price") {
      const p = Number(price);
      if (!Number.isFinite(p) || p <= 0) return null;
      return { price: Math.round(p * 100) / 100, discount: ((mrpNum - p) / mrpNum) * 100 };
    }
    const d = Number(discount);
    if (!Number.isFinite(d) || d < 0 || d >= 100) return null;
    return { price: Math.round(mrpNum * (1 - d / 100) * 100) / 100, discount: d };
  }, [mrpNum, price, discount, priceMode]);

  function submit() {
    setError(null);
    setNotice(null);
    if (!derived) {
      setError("Enter a valid MRP and selling price (or discount %).");
      return;
    }
    startTransition(async () => {
      const result = await saveProduct({
        id: initial?.id,
        name,
        description,
        category_id: categoryId || null,
        new_category: newCategory || undefined,
        mrp: mrpNum,
        selling_price: derived.price,
        active,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const id = result.data!.id;
      // initial stock for a brand-new product (audited)
      if (!initial) {
        const qty = Math.trunc(Number(initialStock));
        if (Number.isInteger(qty) && qty > 0) {
          const inv = await adjustInventory(id, "set", qty, "Initial stock on product creation");
          if (!inv.ok) {
            setError(`Product created, but stock was not set: ${inv.message}`);
          }
        }
        router.replace(`/admin/products/${id}`);
        router.refresh();
        return;
      }
      setNotice("Saved ✓");
      router.refresh();
    });
  }

  function onUploadImage(file: File | null) {
    if (!file || !initial) return;
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set("product_id", initial.id);
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadProductImage(fd);
      if (!result.ok) setError(result.message);
      else {
        setNotice("Image updated ✓");
        router.refresh();
      }
    });
  }

  function onArchiveToggle() {
    if (!initial) return;
    const archiving = !initial.archived;
    if (
      archiving &&
      !window.confirm(
        "Archive this product? It disappears from the shop but stays in past orders and reports."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setProductArchived(initial.id, archiving);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  function onActiveToggle(next: boolean) {
    setActive(next);
    if (!initial) return;
    startTransition(async () => {
      const result = await setProductActive(initial.id, next);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Product name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
                disabled={Boolean(newCategory.trim())}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">…or create new category</span>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Footwear"
                className={inputCls}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Search tags <span className="font-normal text-stone-400">(comma separated)</span>
            </span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="bottle, steel, water"
              className={inputCls}
            />
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Pricing</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">MRP (₹)</span>
              <input
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                inputMode="decimal"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                <select
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as "price" | "discount")}
                  className="rounded border border-stone-200 bg-stone-50 px-1 py-0.5 text-xs"
                >
                  <option value="price">Selling price (₹)</option>
                  <option value="discount">Discount (%)</option>
                </select>
              </span>
              {priceMode === "price" ? (
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                />
              ) : (
                <input
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 10"
                  className={inputCls}
                />
              )}
            </label>
            <div className="rounded-lg bg-stone-50 p-2.5 text-sm">
              {derived ? (
                <>
                  <p className="font-bold">{formatINR(derived.price)}</p>
                  <p className="text-xs text-stone-500">
                    {Number.parseFloat(derived.discount.toFixed(2))}% off {formatINR(mrpNum)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-stone-400">
                  Enter MRP and price/discount to preview
                </p>
              )}
            </div>
          </div>
        </section>

        {!initial && (
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <label className="block sm:w-1/2">
              <span className="mb-1 block text-sm font-medium">Initial stock quantity</span>
              <input
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                inputMode="numeric"
                className={inputCls}
              />
              <span className="mt-1 block text-xs text-stone-500">
                Recorded in the inventory audit log.
              </span>
            </label>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-dark">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
            {notice}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={pending}
            className="h-11 rounded-xl bg-stone-900 px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : initial ? "Save changes" : "Create product"}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onActiveToggle(e.target.checked)}
              className="h-4 w-4 accent-navy"
            />
            Active (visible in shop)
          </label>
        </div>
      </div>

      {/* side panel: image + stock + archive (edit mode) */}
      {initial && (
        <div className="space-y-4">
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Product image
            </h2>
            {initial.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={initial.image_url}
                alt={initial.name}
                className="mb-2 aspect-square w-full rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-lg bg-stone-100 text-4xl">
                🛍️
              </div>
            )}
            <label className="block">
              <span className="sr-only">Upload image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onUploadImage(e.target.files?.[0] ?? null)}
                disabled={pending}
                className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              />
            </label>
            <p className="mt-1 text-xs text-stone-400">JPG/PNG/WebP, max 5 MB.</p>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Stock
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-stone-50 p-2">
                <p className="text-lg font-extrabold">{initial.total_qty}</p>
                <p className="text-xs text-stone-500">Total</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <p className="text-lg font-extrabold">{initial.reserved_qty}</p>
                <p className="text-xs text-stone-500">Reserved</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <p className="text-lg font-extrabold">{initial.available_qty}</p>
                <p className="text-xs text-stone-500">Available</p>
              </div>
            </div>
            <a
              href={`/admin/inventory?q=${encodeURIComponent(initial.name)}`}
              className="mt-2 block text-center text-xs font-semibold text-stone-600 underline"
            >
              Adjust stock in Inventory →
            </a>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Danger zone
            </h2>
            <button
              onClick={onArchiveToggle}
              disabled={pending}
              className={`h-10 w-full rounded-lg text-sm font-semibold ${
                initial.archived
                  ? "bg-cta text-white"
                  : "border border-danger text-danger"
              }`}
            >
              {initial.archived ? "Restore from archive" : "Archive product"}
            </button>
            <p className="mt-1 text-xs text-stone-400">
              Archiving hides the product everywhere but keeps it in historical orders.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
