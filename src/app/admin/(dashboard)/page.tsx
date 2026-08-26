import Link from "next/link";
import { formatINR } from "@/lib/format";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Admin Dashboard", robots: { index: false } };

type Stats = {
  low_stock_threshold: number;
  active_products: number;
  archived_products: number;
  total_stock_units: number;
  reserved_units: number;
  available_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  orders: Record<string, number>;
  total_orders: number;
  order_value_total: number;
  order_value_collected: number;
  units_sold: number;
  free_units_given: number;
};

type LowStockRow = {
  product_id: string;
  name: string;
  selling_price: number;
  total_qty: number;
  reserved_qty: number;
  available_qty: number;
  out_of_stock: boolean;
};

type TopOrderedRow = {
  product_id: string;
  name: string;
  units_ordered: number;
  revenue: number;
};

const ORDER_STATUSES = [
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["ready", "Ready"],
  ["collected", "Collected"],
  ["cancelled", "Cancelled"],
  ["expired", "Expired"],
] as const;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

export default async function AdminHome() {
  const supabase = await authServerClient();
  const [statsRes, lowRes, topRes] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.rpc("admin_top_low_stock", { p_limit: 10 }),
    supabase.rpc("admin_top_ordered", { p_limit: 10 }),
  ]);

  if (statsRes.error) {
    return (
      <div className="rounded-xl border border-sale/30 bg-sale-soft p-4 text-sm">
        <p className="font-semibold text-sale-dark">
          Could not load dashboard data: {statsRes.error.message}
        </p>
        <p className="mt-1 text-stone-600">
          If this mentions a missing function, run{" "}
          <code className="rounded bg-white px-1">supabase/migrations/0004_admin.sql</code>{" "}
          in the Supabase SQL Editor.
        </p>
      </div>
    );
  }

  const stats = statsRes.data as Stats;
  const lowStock = (lowRes.data ?? []) as LowStockRow[];
  const topOrdered = (topRes.data ?? []) as TopOrderedRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active products" value={String(stats.active_products)} />
        <StatCard
          label="Stock units"
          value={String(stats.total_stock_units)}
          sub={`${stats.reserved_units} reserved · ${stats.available_units} available`}
        />
        <StatCard
          label="Total orders"
          value={String(stats.total_orders)}
          sub={`${stats.units_sold} units sold · ${stats.free_units_given} gifts`}
        />
        <StatCard
          label="Order value"
          value={formatINR(stats.order_value_total)}
          sub={`${formatINR(stats.order_value_collected)} collected`}
        />
      </div>

      {/* orders by status */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-500">
          Orders by status
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ORDER_STATUSES.map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/orders?status=${key}`}
              className="rounded-lg bg-stone-50 p-2.5 text-center hover:bg-stone-100"
            >
              <p className="text-lg font-extrabold">{stats.orders[key] ?? 0}</p>
              <p className="text-xs text-stone-500">{label}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* top 10 low inventory */}
        <section className="rounded-xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
              Top 10 low inventory
            </h2>
            <span className="text-xs text-stone-400">
              threshold ≤ {stats.low_stock_threshold} · {stats.out_of_stock_count} out of stock
            </span>
          </div>
          {lowStock.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              No products at or below the low-stock threshold. 👍
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lowStock.map((row) => (
                <li key={row.product_id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/products/${row.product_id}`}
                      className="line-clamp-1 text-sm font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-stone-500">{formatINR(row.selling_price)}</p>
                  </div>
                  {row.out_of_stock ? (
                    <span className="shrink-0 rounded bg-sale-soft px-2 py-0.5 text-xs font-bold text-sale">
                      Out of stock
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-deal-soft px-2 py-0.5 text-xs font-bold text-deal">
                      {row.available_qty} left
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* top 10 most ordered */}
        <section className="rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
              Top 10 most ordered
            </h2>
          </div>
          {topOrdered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              No orders yet — this fills in as customers order.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {topOrdered.map((row, i) => (
                <li key={row.product_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-stone-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${row.product_id}`}
                      className="line-clamp-1 text-sm font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{row.units_ordered} units</p>
                    <p className="text-xs text-stone-500">{formatINR(row.revenue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
