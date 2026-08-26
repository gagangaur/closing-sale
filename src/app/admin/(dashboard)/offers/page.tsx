import { OfferEditor, type OfferRow } from "@/components/admin/OfferEditor";
import { getProductPickerList } from "@/lib/admin-data";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Offers — Admin", robots: { index: false } };

export default async function OffersPage() {
  const supabase = await authServerClient();
  const [{ data }, products] = await Promise.all([
    supabase
      .from("offers")
      .select(
        "id, name, threshold, free_product_id, free_qty, priority, active, archived, products (name, inventory (available_qty))"
      )
      .order("threshold"),
    getProductPickerList(),
  ]);

  const offers: OfferRow[] = ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    threshold: number;
    free_product_id: string;
    free_qty: number;
    priority: number;
    active: boolean;
    archived: boolean;
    products: { name: string; inventory: { available_qty: number } | null } | null;
  }>).map((o) => ({
    id: o.id,
    name: o.name,
    threshold: Number(o.threshold),
    free_product_id: o.free_product_id,
    free_qty: o.free_qty,
    priority: o.priority,
    active: o.active,
    archived: o.archived,
    free_product_name: o.products?.name ?? "(deleted)",
    free_available: o.products?.inventory?.available_qty ?? 0,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Offers &amp; free gifts</h1>
      <p className="max-w-2xl text-sm text-stone-500">
        Customers automatically get the <strong>highest tier</strong> their cart
        qualifies for, as long as the gift is in stock. Gift stock is real inventory —
        reserved when an order is placed.
      </p>
      <OfferEditor offers={offers} products={products} />
    </div>
  );
}
