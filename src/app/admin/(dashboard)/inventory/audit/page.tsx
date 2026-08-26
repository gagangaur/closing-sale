import Link from "next/link";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Inventory Audit — Admin", robots: { index: false } };

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual adjustment",
  order: "Order reservation",
  cancellation: "Order cancelled",
  expiration: "Order expired",
  promo_gift: "Free gift reserved",
  bulk_import: "Bulk import",
  collection: "Collected",
  correction: "Correction",
};

type AuditRow = {
  id: number;
  prev_total: number;
  change: number;
  new_total: number;
  prev_reserved: number;
  new_reserved: number;
  reason: string | null;
  source: string;
  created_at: string;
  products: { id: string; name: string } | null;
  orders: { order_number: string } | null;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const supabase = await authServerClient();
  let query = supabase
    .from("inventory_audit")
    .select(
      "id, prev_total, change, new_total, prev_reserved, new_reserved, reason, source, created_at, products (id, name), orders (order_number)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    // filter by product name via inner join
    query = supabase
      .from("inventory_audit")
      .select(
        "id, prev_total, change, new_total, prev_reserved, new_reserved, reason, source, created_at, products!inner (id, name), orders (order_number)"
      )
      .ilike("products.name", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(200);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-4">
      <nav className="text-sm text-stone-500">
        <Link href="/admin/inventory" className="hover:text-stone-900">
          ← Inventory
        </Link>
      </nav>
      <h1 className="text-xl font-bold">Inventory audit log</h1>
      <p className="text-sm text-stone-500">
        Every stock movement — manual changes, order reservations, gifts,
        cancellations, collections and imports. Latest 200 entries.
      </p>

      <form className="flex gap-2" action="/admin/inventory/audit">
        <input
          name="q"
          defaultValue={q}
          placeholder="Filter by product name…"
          className="h-11 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-sale"
        />
        <button className="h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white">
          Filter
        </button>
      </form>

      {error ? (
        <p className="rounded-xl bg-sale-soft p-4 text-sm font-semibold text-sale-dark">
          Could not load audit log: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No audit entries yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-175 text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-3 py-2.5">When</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5 text-right">Stock</th>
                <th className="px-3 py-2.5 text-right">Reserved</th>
                <th className="px-3 py-2.5">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-500">
                    {new Date(r.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    {r.products ? (
                      <Link
                        href={`/admin/products/${r.products.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.products.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-600">
                      {SOURCE_LABELS[r.source] ?? r.source}
                    </span>
                    {r.orders?.order_number && (
                      <span className="ml-1 font-mono text-stone-400">
                        {r.orders.order_number}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {r.prev_total} →{" "}
                    <strong
                      className={
                        r.change > 0 ? "text-green-700" : r.change < 0 ? "text-sale" : ""
                      }
                    >
                      {r.new_total}
                    </strong>
                    {r.change !== 0 && (
                      <span className="ml-1 text-xs text-stone-400">
                        ({r.change > 0 ? "+" : ""}
                        {r.change})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-stone-500">
                    {r.prev_reserved} → {r.new_reserved}
                  </td>
                  <td className="max-w-60 px-3 py-2 text-xs text-stone-500">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
