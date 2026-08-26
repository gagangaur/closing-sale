"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustInventory } from "@/app/admin/(dashboard)/actions";

/** Inline stock adjuster: set / increase / decrease with a reason (audited). */
export function InventoryAdjust({
  productId,
  reservedQty,
}: {
  productId: string;
  reservedQty: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"set" | "increase" | "decrease">("set");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    const n = Math.trunc(Number(qty));
    if (!Number.isInteger(n) || n < 0 || qty.trim() === "") {
      setError("Enter a whole number.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adjustInventory(productId, mode, n, reason);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setQty("");
      setReason("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700"
      >
        Adjust
      </button>
    );
  }

  return (
    <div className="w-56 space-y-1.5 rounded-lg border border-stone-300 bg-white p-2 text-left shadow-md">
      <div className="flex gap-1.5">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="h-8 flex-1 rounded border border-stone-300 px-1 text-xs"
        >
          <option value="set">Set to</option>
          <option value="increase">Increase by</option>
          <option value="decrease">Decrease by</option>
        </select>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          placeholder="Qty"
          className="h-8 w-16 rounded border border-stone-300 px-2 text-xs"
        />
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (e.g. stock count, damage)"
        className="h-8 w-full rounded border border-stone-300 px-2 text-xs"
      />
      {reservedQty > 0 && mode !== "increase" && (
        <p className="text-[11px] leading-snug text-deal">
          ⚠ {reservedQty} units are reserved for open orders — total stock cannot go
          below that.
        </p>
      )}
      {error && <p className="text-[11px] font-semibold text-sale">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={apply}
          disabled={pending}
          className="h-8 flex-1 rounded bg-stone-900 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? "…" : "Apply"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="h-8 rounded border border-stone-300 px-2 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
