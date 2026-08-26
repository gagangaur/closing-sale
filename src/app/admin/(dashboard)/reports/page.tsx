import Link from "next/link";
import { ORDER_STATUS_LABELS } from "@/lib/types";

export const metadata = { title: "Reports & Exports — Admin", robots: { index: false } };

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reports &amp; exports</h1>

      <section className="max-w-xl rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Export orders to CSV
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          One row per order item — order, customer, collection, product, quantity,
          prices, discounts, free-item flag and totals. Opens in Excel/Google Sheets.
          Filter before exporting if needed.
        </p>
        <form
          action="/api/admin/export-orders"
          method="get"
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="text-xs text-stone-500">
            Status
            <select
              name="status"
              defaultValue=""
              className="mt-0.5 block h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm"
            >
              <option value="">All</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-500">
            From
            <input
              type="date"
              name="from"
              className="mt-0.5 block h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm"
            />
          </label>
          <label className="text-xs text-stone-500">
            To
            <input
              type="date"
              name="to"
              className="mt-0.5 block h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm"
            />
          </label>
          <label className="text-xs text-stone-500">
            Search
            <input
              name="q"
              placeholder="Order ID / customer / phone"
              className="mt-0.5 block h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm"
            />
          </label>
          <button className="h-10 rounded-xl bg-stone-900 px-5 text-sm font-bold text-white">
            Download CSV
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Also available
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Top 10 low-inventory and most-ordered products — on the{" "}
            <Link href="/admin" className="font-semibold underline">
              Dashboard
            </Link>
          </li>
          <li>
            Full stock movement history — in the{" "}
            <Link href="/admin/inventory/audit" className="font-semibold underline">
              Inventory audit log
            </Link>
          </li>
          <li>
            Bulk product import — via{" "}
            <Link href="/admin/products/import" className="font-semibold underline">
              CSV import
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
