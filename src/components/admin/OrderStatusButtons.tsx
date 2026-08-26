"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeOrderStatus } from "@/app/admin/(dashboard)/actions";

type Status = "pending" | "confirmed" | "ready" | "collected" | "cancelled" | "expired";

/** Allowed transitions from each status (final states have none). */
const TRANSITIONS: Record<Status, Array<{ to: Exclude<Status, "pending">; label: string; style: string; confirm?: string }>> = {
  pending: [
    { to: "confirmed", label: "Confirm order", style: "bg-blue-600 text-white" },
    { to: "ready", label: "Mark ready", style: "bg-green-600 text-white" },
    { to: "cancelled", label: "Cancel", style: "border border-sale text-sale", confirm: "Cancel this order and release its reserved stock?" },
    { to: "expired", label: "Expire", style: "border border-stone-300 text-stone-600", confirm: "Expire this order and release its reserved stock?" },
  ],
  confirmed: [
    { to: "ready", label: "Mark ready for collection", style: "bg-green-600 text-white" },
    { to: "collected", label: "Mark collected & paid", style: "bg-stone-900 text-white", confirm: "Mark as collected? Stock will be deducted permanently." },
    { to: "cancelled", label: "Cancel", style: "border border-sale text-sale", confirm: "Cancel this order and release its reserved stock?" },
    { to: "expired", label: "Expire", style: "border border-stone-300 text-stone-600", confirm: "Expire this order and release its reserved stock?" },
  ],
  ready: [
    { to: "collected", label: "Mark collected & paid", style: "bg-stone-900 text-white", confirm: "Mark as collected? Stock will be deducted permanently." },
    { to: "cancelled", label: "Cancel", style: "border border-sale text-sale", confirm: "Cancel this order and release its reserved stock?" },
    { to: "expired", label: "Expire", style: "border border-stone-300 text-stone-600", confirm: "Expire this order and release its reserved stock?" },
  ],
  collected: [],
  cancelled: [],
  expired: [],
};

export function OrderStatusButtons({
  orderId,
  status,
}: {
  orderId: string;
  status: Status;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = TRANSITIONS[status];
  if (options.length === 0) {
    return (
      <p className="text-xs text-stone-500">
        This order is <strong>{status}</strong> — a final status. No further changes are
        possible.
      </p>
    );
  }

  function transition(to: Exclude<Status, "pending">, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      const result = await changeOrderStatus(orderId, to, note);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the status change…"
        className="h-10 w-full rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-sale"
      />
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.to}
            onClick={() => transition(opt.to, opt.confirm)}
            disabled={pending}
            className={`h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${opt.style}`}
          >
            {pending ? "…" : opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-sale">{error}</p>}
    </div>
  );
}
