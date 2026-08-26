import type { PublicSettings } from "@/lib/types";

export function Footer({ settings }: { settings: PublicSettings }) {
  return (
    <footer className="mt-12 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-sm text-stone-600">
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-900">
            How it works
          </h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Browse and add items to your bucket.</li>
            <li>Reserve your order and get a unique Order ID.</li>
            <li>Collect and pay at your selected pickup point — no home delivery.</li>
            <li>{settings.payment_instructions}</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-900">
            Final sale policy
          </h2>
          <p>{settings.final_sale_terms}</p>
        </section>

        {settings.shop_address && (
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-900">
              Shop
            </h2>
            <p>{settings.shop_address}</p>
            {settings.shop_timings && <p>{settings.shop_timings}</p>}
          </section>
        )}

        <p className="border-t border-stone-100 pt-4 text-xs text-stone-400">
          {settings.shop_name} — closing sale. All prices include applicable taxes.
        </p>
      </div>
    </footer>
  );
}
