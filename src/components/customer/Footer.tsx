import { POLICY_LINE } from "@/lib/branding";
import type { PublicSettings } from "@/lib/types";

export function Footer({ settings }: { settings: PublicSettings }) {
  return (
    <footer className="mt-12 border-t border-navy/10 bg-navy-soft">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-sm text-stone-600">
        {settings.thank_you_message && (
          <p className="text-base font-semibold italic text-navy">
            {settings.thank_you_message}
          </p>
        )}

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
            How it works
          </h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Browse and add items to your bucket.</li>
            <li>Reserve your order and get a unique Order ID.</li>
            <li>Collect and pay at your selected pickup point — no home delivery.</li>
            <li>{settings.payment_instructions}</li>
          </ol>
          {settings.sale_days && (
            <p className="mt-2 font-bold text-navy">
              Sale &amp; collection: {settings.sale_days}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
            Final sale policy
          </h2>
          <p>{settings.final_sale_terms}</p>
          <p className="mt-1 text-xs text-stone-500">{POLICY_LINE}</p>
        </section>

        {settings.shop_address && (
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy">
              Shop
            </h2>
            <p>{settings.shop_address}</p>
            {settings.shop_timings && <p>{settings.shop_timings}</p>}
          </section>
        )}

        <p className="border-t border-navy/10 pt-4 text-xs text-stone-500">
          {settings.shop_name} — closing sale. All prices include applicable taxes.
        </p>
      </div>
    </footer>
  );
}
