"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOffer, setOfferArchived, type OfferInput } from "@/app/admin/(dashboard)/actions";

export type OfferRow = {
  id: string;
  name: string;
  threshold: number;
  free_product_id: string;
  free_qty: number;
  priority: number;
  active: boolean;
  archived: boolean;
  free_product_name: string;
  free_available: number;
};

type PickerProduct = { id: string; name: string; available_qty: number };

const inputCls =
  "h-10 w-full rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20";

function OfferForm({
  products,
  initial,
  onDone,
}: {
  products: PickerProduct[];
  initial: OfferRow | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OfferInput>({
    id: initial?.id,
    name: initial?.name ?? "",
    threshold: initial?.threshold ?? 0,
    free_product_id: initial?.free_product_id ?? "",
    free_qty: initial?.free_qty ?? 1,
    priority: initial?.priority ?? 0,
    active: initial?.active ?? true,
  });

  function submit() {
    setError(null);
    if (!form.free_product_id) {
      setError("Select the free product.");
      return;
    }
    startTransition(async () => {
      const result = await saveOffer(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-300 bg-stone-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Offer name (shown to customers)</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Free Steel Lunch Box on orders above ₹1,000"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Cart threshold (₹)</span>
          <input
            value={form.threshold || ""}
            onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
            inputMode="decimal"
            placeholder="1000"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Free product</span>
          <select
            value={form.free_product_id}
            onChange={(e) => setForm({ ...form, free_product_id: e.target.value })}
            className={inputCls}
          >
            <option value="">— Select product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.available_qty} available)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Free quantity</span>
          <input
            value={form.free_qty}
            onChange={(e) => setForm({ ...form, free_qty: Number(e.target.value) })}
            inputMode="numeric"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Priority <span className="font-normal text-stone-400">(tie-break, higher wins)</span>
          </span>
          <input
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            inputMode="numeric"
            className={inputCls}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
          className="h-4 w-4 accent-navy"
        />
        Active
      </label>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="h-10 rounded-lg bg-stone-900 px-5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save offer" : "Create offer"}
        </button>
        <button
          onClick={onDone}
          className="h-10 rounded-lg border border-stone-300 px-4 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function OfferEditor({
  offers,
  products,
}: {
  offers: OfferRow[];
  products: PickerProduct[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, startTransition] = useTransition();

  function toggleArchive(offer: OfferRow) {
    const archiving = !offer.archived;
    if (archiving && !window.confirm("Archive this offer? It stops applying immediately.")) return;
    startTransition(async () => {
      await setOfferArchived(offer.id, archiving);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {editing === "new" ? (
        <OfferForm products={products} initial={null} onDone={() => setEditing(null)} />
      ) : (
        <button
          onClick={() => setEditing("new")}
          className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          + New offer
        </button>
      )}

      {offers.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No offers yet. Create tiers like “Free gift above ₹1,000”.
        </p>
      )}

      <ul className="space-y-2">
        {offers.map((offer) =>
          editing === offer.id ? (
            <li key={offer.id}>
              <OfferForm
                products={products}
                initial={offer}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={offer.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 ${
                offer.archived ? "border-stone-200 opacity-60" : "border-stone-200"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{offer.name}</p>
                <p className="text-xs text-stone-500">
                  Spend ₹{offer.threshold} → {offer.free_qty} × {offer.free_product_name}{" "}
                  <span className={offer.free_available < offer.free_qty ? "font-bold text-danger" : ""}>
                    ({offer.free_available} gift stock left)
                  </span>
                </p>
              </div>
              {offer.archived ? (
                <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
                  Archived
                </span>
              ) : offer.active ? (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                  Active
                </span>
              ) : (
                <span className="rounded bg-deal-soft px-2 py-0.5 text-xs font-semibold text-deal">
                  Inactive
                </span>
              )}
              <div className="flex gap-2">
                {!offer.archived && (
                  <button
                    onClick={() => setEditing(offer.id)}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => toggleArchive(offer)}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600"
                >
                  {offer.archived ? "Restore" : "Archive"}
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
