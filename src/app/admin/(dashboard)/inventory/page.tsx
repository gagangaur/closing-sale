import Link from "next/link";
import { InventoryAdjust } from "@/components/admin/InventoryAdjust";
import { getCategoriesForAdmin } from "@/lib/admin-data";
import { formatINR } from "@/lib/format";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Inventory — Admin", robots: { index: false } };

type Row = {
  id: string;
  name: string;
  selling_price: number;
  active: boolean;
  category_id: string | null;
  categories: { name: string } | null;
  inventory: { total_qty: number; reserved_qty: number; available_qty: number } | null;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const stock = typeof sp.stock === "string" ? sp.stock : "all";

  const supabase = await authServerClient();

  const [{ data: settingsRow }, categories] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "low_stock_threshold").maybeSingle(),
    getCategoriesForAdmin(),
  ]);
  const threshold = Number(settingsRow?.value ?? 10) || 10;

  let query = supabase
    .from("products")
    .select(
      "id, name, selling_price, active, category_id, categories (name), inventory (total_qty, reserved_qty, available_qty)"
    )
    .eq("archived", false)
    .order("name")
    .limit(500);
  if (q) query = query.ilike("name", `%${q}%`);
  if (category) query = query.eq("category_id", category);

  const { data, error } = await query;
  let rows = (data ?? []) as unknown as Row[];

  // stock filters need the joined inventory values — filter here (bounded to 500 rows)
  if (stock === "low") {
    rows = rows.filter((r) => {
      const a = r.inventory?.available_qty ?? 0;
      return a > 0 && a <= threshold;
    });
  } else if (stock === "out") {
    rows = rows.filter((r) => (r.inventory?.available_qty ?? 0) <= 0);
  }

  const link = (params: Record<string, string>, label: string, isActive: boolean) => {
    const spOut = new URLSearchParams({ q, category, stock, ...params });
    return (
      <Link
        href={`/admin/inventory?${spOut.toString()}`}
        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
          isActive ? "bg-stone-900 text-white" : "border border-stone-300 bg-white text-stone-600"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Inventory</h1>
        <Link
          href="/admin/inventory/audit"
          className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold"
        >
          View audit log
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/inventory">
        <input type="hidden" name="stock" value={stock} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products…"
          className="h-11 min-w-40 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-sale"
        />
        <select
          name="category"
          defaultValue={category}
          className="h-11 rounded-xl border border-stone-300 bg-white px-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white">
          Filter
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {link({ stock: "all" }, "All", stock === "all")}
        {link({ stock: "low" }, `Low stock (≤ ${threshold})`, stock === "low")}
        {link({ stock: "out" }, "Out of stock", stock === "out")}
      </div>

      {error ? (
        <p className="rounded-xl bg-sale-soft p-4 text-sm font-semibold text-sale-dark">
          Could not load inventory: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          {stock === "low"
            ? "No low-stock items — nothing at or below the threshold."
            : stock === "out"
              ? "Nothing is out of stock. 👍"
              : "No products found."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-175 text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Price</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">Reserved</th>
                <th className="px-3 py-2.5 text-right">Available</th>
                <th className="px-3 py-2.5">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => {
                const available = r.inventory?.available_qty ?? 0;
                const isOut = available <= 0;
                const isLow = !isOut && available <= threshold;
                const isVeryLow = !isOut && available <= Math.max(1, Math.floor(threshold / 2));
                return (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/products/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="ml-2 text-xs text-stone-400">
                        {r.categories?.name ?? ""}
                        {!r.active && " · inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{formatINR(r.selling_price)}</td>
                    <td className="px-3 py-2 text-right">{r.inventory?.total_qty ?? 0}</td>
                    <td className="px-3 py-2 text-right text-stone-500">
                      {r.inventory?.reserved_qty ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={
                          isOut
                            ? "rounded bg-sale-soft px-1.5 py-0.5 text-xs font-bold text-sale"
                            : isVeryLow
                              ? "rounded bg-sale-soft px-1.5 py-0.5 text-xs font-bold text-sale-dark"
                              : isLow
                                ? "rounded bg-deal-soft px-1.5 py-0.5 text-xs font-bold text-deal"
                                : "font-semibold"
                        }
                      >
                        {isOut ? "Out" : available}
                        {isVeryLow && !isOut ? " · very low" : isLow && !isVeryLow ? " · low" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <InventoryAdjust
                        productId={r.id}
                        reservedQty={r.inventory?.reserved_qty ?? 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
