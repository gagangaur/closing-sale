import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Admin", robots: { index: false } };

/**
 * Admin dashboard home — foundation version.
 * The complete operational dashboard (products, inventory, orders, offers,
 * locations, reports, settings) is built in the next phase.
 */
export default async function AdminHome() {
  const supabase = await authServerClient();

  const [products, orders] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("archived", false),
    supabase.from("orders").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Active products</p>
          <p className="mt-1 text-2xl font-extrabold">{products.count ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Total orders</p>
          <p className="mt-1 text-2xl font-extrabold">{orders.count ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-green-700">
            Foundation running ✓
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <p className="font-semibold text-stone-900">Coming in the next build phase:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Product &amp; inventory management with audit log</li>
          <li>Order management with status workflow</li>
          <li>Offers, collection locations and shop settings</li>
          <li>CSV import/export and reports</li>
        </ul>
      </div>
    </div>
  );
}
