"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/admin/(dashboard)/actions";

const FIELDS: Array<{
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "textarea" | "number";
}> = [
  { key: "shop_name", label: "Shop name", kind: "text" },
  { key: "sale_title", label: "Headline", hint: "e.g. CLOSING SALE", kind: "text" },
  {
    key: "sale_subtitle",
    label: "Sub-headline (shown prominently)",
    hint: "e.g. Heavy Discount SALE — do not put percentages here.",
    kind: "text",
  },
  {
    key: "legacy_badge",
    label: "Legacy badge",
    hint: "Short farewell badge, e.g. Serving Mathura for 28 years",
    kind: "text",
  },
  { key: "sale_message", label: "Farewell message", kind: "textarea" },
  { key: "thank_you_message", label: "Thank-you line", kind: "text" },
  {
    key: "sale_days",
    label: "Sale days callout",
    hint: "Shown as a bold strip on every page, e.g. ONLY ON SATURDAY & SUNDAY",
    kind: "text",
  },
  {
    key: "whatsapp_number",
    label: "WhatsApp number",
    hint: "Digits only with country code, e.g. 919876543210. Order messages are sent here.",
    kind: "text",
  },
  {
    key: "min_order_value",
    label: "Minimum order value (₹)",
    hint: "Customers cannot place an order below this amount.",
    kind: "number",
  },
  {
    key: "low_stock_threshold",
    label: "Low-stock threshold",
    hint: "At or below this quantity, customers see “Only X left”.",
    kind: "number",
  },
  { key: "shop_address", label: "Shop address", kind: "textarea" },
  { key: "shop_timings", label: "Shop timings", kind: "text" },
  { key: "payment_instructions", label: "Payment instructions", kind: "textarea" },
  { key: "collection_instructions", label: "Collection instructions", kind: "textarea" },
  { key: "final_sale_terms", label: "Final-sale terms", kind: "textarea" },
  {
    key: "customer_notes",
    label: "Extra customer notes",
    hint: "Optional additional instructions shown to customers.",
    kind: "textarea",
  },
];

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20";

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveSettings(
        Object.entries(values).map(([key, value]) => ({ key, value }))
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice("Settings saved ✓ — the customer site updates immediately.");
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-sm font-medium">{f.label}</span>
          {f.kind === "textarea" ? (
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              rows={3}
              className={inputCls}
            />
          ) : (
            <input
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              inputMode={f.kind === "number" ? "numeric" : undefined}
              className={inputCls}
            />
          )}
          {f.hint && <span className="mt-1 block text-xs text-stone-500">{f.hint}</span>}
        </label>
      ))}

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

      <button
        onClick={submit}
        disabled={pending}
        className="h-11 rounded-xl bg-stone-900 px-6 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
