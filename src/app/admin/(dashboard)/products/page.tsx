import Link from "next/link";
import { formatINR } from "@/lib/format";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Products — Admin", robots: { index: false } };

const PAGE_SIZE = 30;

type Row = {
  id: string;
  name: string;
  image_url: string | null;
  mrp: number;
  selling_price: number;
  discount_pct: number;
  active: boolean;
  archived: boolean;
  categories: { name: string } | null;
  inventory: { total_qty: number; reserved_qty: number; available_qty: number } | null;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "all";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const supabase = await authServerClient();
  let query = supabase
    .from("products")
    .select(
      "id, name, image_url, mrp, selling_price, discount_pct, active, archived, categories (name), inventory (total_qty, reserved_qty, available_qty)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("name", `%${q}%`);
  if (status === "active") query = query.eq("active", true).eq("archived", false);
  if (status === "inactive") query = query.eq("active", false).eq("archived", false);
  if (status === "archived") query = query.eq("archived", true);
  if (status === "all") query = query.eq("archived", false);

  const { data, error, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterLink = (s: string, label: string) => (
    <Link
      key={s}
      href={`/admin/products?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
        status === s ? "bg-stone-900 text-white" : "bg-white text-stone-600 border border-stone-300"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/products/import"
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Import CSV
          </Link>
          <Link
            href="/admin/products/new"
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Add product
          </Link>
        </div>
      </div>

      <form className="flex gap-2" action="/admin/products">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products…"
          className="h-11 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-sale"
        />
        <button className="h-11 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {filterLink("all", "All")}
        {filterLink("active", "Active")}
        {filterLink("inactive", "Inactive")}
        {filterLink("archived", "Archived")}
      </div>

      {error ? (
        <p className="rounded-xl bg-sale-soft p-4 text-sm font-semibold text-sale-dark">
          Could not load products: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No products found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-175 text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5 text-right">MRP</th>
                <th className="px-3 py-2.5 text-right">Price</th>
                <th className="px-3 py-2.5 text-right">Off</th>
                <th className="px-3 py-2.5 text-right">Avail / Total</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((p) => {
                const inv = p.inventory as unknown as Row["inventory"];
                return (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-2.5">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-9 w-9 rounded-md object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-stone-100">
                            🛍️
                          </span>
                        )}
                        <span className="font-medium hover:underline">{p.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-stone-500">
                      {(p.categories as unknown as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-500">{formatINR(p.mrp)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatINR(p.selling_price)}
                    </td>
                    <td className="px-3 py-2 text-right text-sale">
                      {Number.parseFloat(Number(p.discount_pct).toFixed(2))}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={
                          (inv?.available_qty ?? 0) <= 0 ? "font-bold text-sale" : "font-semibold"
                        }
                      >
                        {inv?.available_qty ?? 0}
                      </span>
                      <span className="text-stone-400"> / {inv?.total_qty ?? 0}</span>
                    </td>
                    <td className="px-3 py-2">
                      {p.archived ? (
                        <span className="rounded bg-stone-200 px-1.5 py-0.5 text-xs font-semibold text-stone-600">
                          Archived
                        </span>
                      ) : p.active ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded bg-deal-soft px-1.5 py-0.5 text-xs font-semibold text-deal">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/products?status=${status}&q=${encodeURIComponent(q)}&page=${page - 1}`}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5"
            >
              ← Prev
            </Link>
          )}
          <span className="text-stone-500">
            Page {page} of {totalPages} ({total} products)
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/products?status=${status}&q=${encodeURIComponent(q)}&page=${page + 1}`}
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
