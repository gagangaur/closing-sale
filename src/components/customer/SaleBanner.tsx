import { formatINR } from "@/lib/format";
import type { OfferTier, PublicSettings } from "@/lib/types";

export function SaleBanner({
  settings,
  tiers,
}: {
  settings: PublicSettings;
  tiers: OfferTier[];
}) {
  return (
    <section
      aria-label="Closing sale announcement"
      className="rounded-2xl bg-gradient-to-br from-sale to-sale-dark px-4 py-5 text-white shadow-md"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">
        Everything must go
      </p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
        {settings.sale_title}
      </h1>
      {settings.sale_message && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-50">
          {settings.sale_message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-white/15 px-3 py-1">
          🏷️ Genuine clearance prices
        </span>
        <span className="rounded-full bg-white/15 px-3 py-1">
          📦 Limited stock — buy while it lasts
        </span>
        <span className="rounded-full bg-white/15 px-3 py-1">
          🤝 Reserve online · Collect &amp; pay at pickup
        </span>
        {settings.min_order_value > 0 && (
          <span className="rounded-full bg-white/15 px-3 py-1">
            Minimum order {formatINR(settings.min_order_value)}
          </span>
        )}
      </div>
      {tiers.filter((t) => t.in_stock).length > 0 && (
        <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
          🎁{" "}
          {tiers
            .filter((t) => t.in_stock)
            .map((t) => `FREE ${t.free_product_name} above ${formatINR(t.threshold)}`)
            .join(" · ")}
        </div>
      )}
      <p className="mt-3 text-xs text-red-100">
        Final sale — no returns/exchanges · No home delivery · Cash preferred, UPI
        accepted at the shop · No online payment.
      </p>
    </section>
  );
}
