import { ShareSale } from "@/components/customer/ShareSale";
import { formatINR } from "@/lib/format";
import type { OfferTier, PublicSettings } from "@/lib/types";

/**
 * Hero. Content hierarchy (all text admin-configurable in Settings):
 *   shop name → headline → prominent sub-headline → legacy badge →
 *   farewell message → thank-you → Limited Stock / sale-days strip →
 *   existing reservation info, gift tiers and the shareable policy card.
 */
export function SaleBanner({
  settings,
  tiers,
}: {
  settings: PublicSettings;
  tiers: OfferTier[];
}) {
  const inStockTiers = tiers.filter((t) => t.in_stock);

  return (
    <section
      aria-label="Closing sale announcement"
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-dark text-white shadow-md ring-1 ring-navy-dark/40"
    >
      <div className="px-4 pt-5 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-blue-200">
          {settings.shop_name}
        </p>

        <h1 className="mt-2 text-3xl font-black leading-none tracking-tight sm:text-4xl">
          {settings.sale_title}
        </h1>
        {settings.sale_subtitle && (
          <p className="mt-2 inline-block rounded-lg bg-gold px-3 py-1.5 text-xl font-black leading-none text-navy-dark sm:text-2xl">
            {settings.sale_subtitle}
          </p>
        )}

        {settings.legacy_badge && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50 ring-1 ring-gold/60">
            <span aria-hidden="true">✦</span> {settings.legacy_badge}
          </p>
        )}

        {settings.sale_message && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-50 sm:text-base">
            {settings.sale_message}
          </p>
        )}
        {settings.thank_you_message && (
          <p className="mt-2 text-sm italic text-blue-100">{settings.thank_you_message}</p>
        )}
      </div>

      {/* Limited stock + sale days — the loudest element after the headline */}
      {settings.sale_days && (
        <div className="mt-4 bg-gold px-4 py-2.5 text-center text-navy-dark sm:px-6">
          <p className="text-sm font-extrabold uppercase tracking-widest">Limited Stock</p>
          <p className="text-lg font-black uppercase tracking-wide sm:text-xl">
            {settings.sale_days}
          </p>
        </div>
      )}

      <div className="space-y-3 px-4 pb-4 pt-4 sm:px-6">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/15 px-3 py-1">
            🤝 Reserve online · Collect &amp; pay at pickup
          </span>
          {settings.min_order_value > 0 && (
            <span className="rounded-full bg-white/15 px-3 py-1">
              Minimum order {formatINR(settings.min_order_value)}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1">
            🏷️ Heavy discounts — a genuine closing sale
          </span>
        </div>

        {inStockTiers.length > 0 && (
          <div className="rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-cta/50">
            🎁{" "}
            {inStockTiers
              .map((t) => `FREE ${t.free_product_name} above ${formatINR(t.threshold)}`)
              .join(" · ")}
          </div>
        )}

        <ShareSale settings={settings} />
      </div>
    </section>
  );
}
