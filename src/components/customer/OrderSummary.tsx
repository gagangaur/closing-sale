import { formatINR, formatSlotDate, formatSlotTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderView } from "@/lib/types";

const STATUS_STYLES: Record<OrderView["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  collected: "bg-stone-200 text-stone-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-stone-200 text-stone-500",
};

/** Read-only order card. Orders cannot be modified after placement. */
export function OrderSummary({ order }: { order: OrderView }) {
  const loc = order.location as {
    type?: string;
    name?: string;
    area?: string;
    shop_address?: string;
    shop_timings?: string;
  };
  const slot = order.slot as {
    slot_date?: string;
    start_time?: string;
    end_time?: string;
  } | null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Order ID</p>
            <p className="font-mono text-lg font-extrabold">{order.order_number}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          {order.customer_name} · {order.customer_phone}
        </p>
        <p className="text-xs text-stone-400">
          Placed on{" "}
          {new Date(order.created_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-stone-500">
          Collection
        </h2>
        {order.is_other_location || loc.type === "other" ? (
          <>
            <p className="text-sm font-semibold">Shop pickup</p>
            {loc.shop_address && <p className="text-sm text-stone-600">{loc.shop_address}</p>}
            {loc.shop_timings && <p className="text-sm text-stone-600">{loc.shop_timings}</p>}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">
              {loc.name}
              {loc.area ? `, ${loc.area}` : ""}
            </p>
            {slot?.slot_date && slot.start_time && slot.end_time && (
              <p className="text-sm text-stone-600">
                {formatSlotDate(slot.slot_date)} · {formatSlotTime(slot.start_time)} –{" "}
                {formatSlotTime(slot.end_time)}
              </p>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <h2 className="border-b border-stone-100 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-stone-500">
          Items
        </h2>
        <ul className="divide-y divide-stone-100">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.product_name}{" "}
                  {item.is_free && (
                    <span className="ml-1 rounded bg-deal px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                      Free
                    </span>
                  )}
                </p>
                <p className="text-xs text-stone-500">
                  {item.is_free
                    ? `Qty ${item.quantity}`
                    : `Qty ${item.quantity} × ${formatINR(item.unit_price)}${
                        item.mrp > item.unit_price ? ` (MRP ${formatINR(item.mrp)})` : ""
                      }`}
                </p>
              </div>
              <span className="text-sm font-bold">
                {item.is_free ? "₹0" : formatINR(item.line_total)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-stone-200 px-4 py-3 text-base font-extrabold">
          <span>Total payable at collection</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>

      {order.note && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-stone-500">
            Your note
          </h2>
          <p className="text-sm text-stone-700">{order.note}</p>
        </div>
      )}

      <p className="rounded-xl bg-stone-100 px-4 py-3 text-xs leading-relaxed text-stone-600">
        This order cannot be edited after placement. If something is wrong, contact the
        shop on WhatsApp quoting your Order ID. Final sale — inspect goods before
        accepting; no returns or exchanges after purchase.
      </p>
    </div>
  );
}
