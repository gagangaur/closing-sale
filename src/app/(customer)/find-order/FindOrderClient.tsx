"use client";

import { useState } from "react";
import { OrderSummary } from "@/components/customer/OrderSummary";
import type { OrderView } from "@/lib/types";

export function FindOrderClient({ initialOrderNumber }: { initialOrderNumber: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber.trim(), phone: phone.trim() }),
      });
      const data = (await res.json()) as
        | { ok: true; order: OrderView }
        | { ok: false; message: string };
      if (data.ok) {
        setOrder(data.order);
      } else {
        setError(data.message || "Order not found.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">Find my order</h1>
        <p className="mt-1 text-sm text-stone-500">
          Enter your Order ID and the phone number you used when placing the order.
        </p>
      </div>

      <form onSubmit={lookup} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Order ID</span>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. CS-2026-000123"
            autoCapitalize="characters"
            className="h-12 w-full rounded-lg border border-stone-300 px-3 font-mono text-base uppercase outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Phone number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="Phone used on the order"
            className="h-12 w-full rounded-lg border border-stone-300 px-3 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !orderNumber.trim() || !phone.trim()}
          className="h-12 w-full rounded-xl bg-cta text-sm font-bold text-white disabled:bg-stone-300"
        >
          {loading ? "Looking up…" : "Find order"}
        </button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </form>

      {order && <OrderSummary order={order} />}
    </div>
  );
}
