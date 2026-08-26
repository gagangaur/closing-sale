import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusButtons } from "@/components/admin/OrderStatusButtons";
import { formatINR, formatSlotDate, formatSlotTime } from "@/lib/format";
import { authServerClient } from "@/lib/supabase/server-auth";
import { ORDER_STATUS_LABELS, type OrderView } from "@/lib/types";

export const metadata = { title: "Order — Admin", robots: { index: false } };

type ItemRow = {
  id: number;
  product_id: string;
  product_name: string;
  mrp: number;
  unit_price: number;
  discount_pct: number;
  quantity: number;
  line_total: number;
  is_free: boolean;
};

type HistoryRow = {
  id: number;
  old_status: string | null;
  new_status: string;
  note: string;
  created_at: string;
  changed_by: string | null;
};

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await authServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: itemsData }, { data: historyData }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("is_free").order("id"),
    supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const items = (itemsData ?? []) as ItemRow[];
  const history = (historyData ?? []) as HistoryRow[];

  const loc = (order.location_snapshot ?? {}) as {
    name?: string;
    area?: string;
    description?: string;
    shop_address?: string;
    shop_timings?: string;
  };
  const slot = order.slot_snapshot as {
    slot_date?: string;
    start_time?: string;
    end_time?: string;
  } | null;
  const status = order.status as OrderView["status"];

  return (
    <div className="space-y-4">
      <nav className="text-sm text-stone-500">
        <Link href="/admin/orders" className="hover:text-stone-900">
          ← Orders
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-extrabold">{order.order_number}</h1>
        <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-700">
          {ORDER_STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-stone-400">
          Placed{" "}
          {new Date(order.created_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* items — historical snapshots, never re-read from the catalog */}
          <section className="rounded-xl border border-stone-200 bg-white">
            <h2 className="border-b border-stone-100 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-stone-500">
              Items (order-time prices)
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-stone-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {item.product_name}
                        {item.is_free && (
                          <span className="ml-1.5 rounded bg-deal px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                            Free
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-500">
                        {item.is_free
                          ? `Qty ${item.quantity}`
                          : `Qty ${item.quantity} × ${formatINR(item.unit_price)} · MRP ${formatINR(item.mrp)} · ${Number.parseFloat(Number(item.discount_pct).toFixed(2))}% off`}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {item.is_free ? "₹0" : formatINR(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t border-stone-200 px-4 py-3 font-extrabold">
              <span>Total payable at collection</span>
              <span>{formatINR(Number(order.total))}</span>
            </div>
          </section>

          {/* status history */}
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Status history
            </h2>
            <ol className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-xs text-stone-400">
                    {new Date(h.created_at).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span>
                    {h.old_status ? `${h.old_status} → ` : ""}
                    <strong>{h.new_status}</strong>
                    {h.note && <span className="text-stone-500"> — {h.note}</span>}
                    <span className="text-xs text-stone-400">
                      {" "}
                      · {h.changed_by ? "admin" : "system"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-4">
          {/* customer + collection */}
          <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Customer
            </h2>
            <p className="font-semibold">{order.customer_name}</p>
            <a
              href={`https://wa.me/${order.customer_phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 underline"
            >
              {order.customer_phone} (WhatsApp)
            </a>
            {order.customer_note && (
              <p className="mt-2 rounded-lg bg-stone-50 p-2 text-xs text-stone-600">
                “{order.customer_note}”
              </p>
            )}
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Collection
            </h2>
            {order.is_other_location ? (
              <>
                <p className="font-semibold">Shop pickup</p>
                {loc.shop_address && <p className="text-stone-600">{loc.shop_address}</p>}
                {loc.shop_timings && <p className="text-stone-600">{loc.shop_timings}</p>}
              </>
            ) : (
              <>
                <p className="font-semibold">
                  {loc.name}
                  {loc.area ? `, ${loc.area}` : ""}
                </p>
                {slot?.slot_date && slot.start_time && slot.end_time && (
                  <p className="text-stone-600">
                    {formatSlotDate(slot.slot_date)} · {formatSlotTime(slot.start_time)} –{" "}
                    {formatSlotTime(slot.end_time)}
                  </p>
                )}
              </>
            )}
          </section>

          {/* actions */}
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
              Update status
            </h2>
            <OrderStatusButtons orderId={order.id} status={status} />
            <p className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-400">
              Order contents cannot be edited — customers were told orders are final. For
              exceptional corrections, cancel this order (stock is released) and place a
              corrected one.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
