import Link from "next/link";
import { formatINR } from "@/lib/format";
import { authServerClient } from "@/lib/supabase/server-auth";
import { ORDER_STATUS_LABELS, type OrderView } from "@/lib/types";

export const metadata = { title: "Orders — Admin", robots: { index: false } };

const PAGE_SIZE = 30;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  collected: "bg-stone-200 text-stone-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-stone-200 text-stone-500",
};

type Row = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderView["status"];
  total: number;
  item_count: number;
  is_other_location: boolean;
  location_snapshot: { name?: string } | null;
  created_at: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const location = typeof sp.location === "string" ? sp.location : "";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const supabase = await authServerClient();
  const { data: locationRows } = await supabase
    .from("locations")
    .select("id, name")
    .order("sort_order");
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, status, total, item_count, is_other_location, location_snapshot, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (location === "other") query = query.eq("is_other_location", true);
  else if (location) query = query.eq("location_id", location);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (q) {
    query = query.or(
      `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildLink = (params: Record<string, string>) => {
    const spOut = new URLSearchParams({ status, q, from, to, location, ...params });
    for (const [k, v] of [...spOut.entries()]) if (!v) spOut.delete(k);
    return `/admin/orders?${spOut.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Orders</h1>

      <form className="flex flex-wrap items-end gap-2" action="/admin/orders">
        <input
          name="q"
          defaultValue={q}
          placeholder="Order ID, customer or phone…"
          className="h-11 min-w-52 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-sale"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-11 rounded-xl border border-stone-300 bg-white px-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="location"
          defaultValue={location}
          className="h-11 rounded-xl border border-stone-300 bg-white px-2 text-sm"
        >
          <option value="">All locations</option>
          {(locationRows ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <option value="other">Shop pickup (Other)</option>
        </select>
        <label className="text-xs text-stone-500">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="ml-1 h-11 rounded-xl border border-stone-300 bg-white px-2 text-sm"
          />
        </label>
        <label className="text-xs text-stone-500">
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="ml-1 h-11 rounded-xl border border-stone-300 bg-white px-2 text-sm"
          />
        </label>
        <button className="h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white">
          Filter
        </button>
      </form>

      {error ? (
        <p className="rounded-xl bg-sale-soft p-4 text-sm font-semibold text-sale-dark">
          Could not load orders: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No orders match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-175 text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Collection</th>
                <th className="px-3 py-2.5 text-right">Items</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {o.order_number}
                    </Link>
                    <p className="text-xs text-stone-400">
                      {new Date(o.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{o.customer_name}</p>
                    <p className="text-xs text-stone-500">{o.customer_phone}</p>
                  </td>
                  <td className="px-3 py-2 text-stone-600">
                    {o.is_other_location
                      ? "Shop pickup"
                      : (o.location_snapshot?.name ?? "—")}
                  </td>
                  <td className="px-3 py-2 text-right">{o.item_count}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatINR(o.total)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[o.status]}`}
                    >
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={buildLink({ page: String(page - 1) })}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5"
            >
              ← Prev
            </Link>
          )}
          <span className="text-stone-500">
            Page {page} of {totalPages} ({total} orders)
          </span>
          {page < totalPages && (
            <Link
              href={buildLink({ page: String(page + 1) })}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
