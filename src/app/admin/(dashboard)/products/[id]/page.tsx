import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm, type ProductFormInitial } from "@/components/admin/ProductForm";
import { getCategoriesForAdmin } from "@/lib/admin-data";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Edit Product — Admin", robots: { index: false } };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await authServerClient();
  const [{ data }, categories] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, category_id, image_url, mrp, selling_price, active, archived, product_tags (tag), inventory (total_qty, reserved_qty, available_qty)"
      )
      .eq("id", id)
      .maybeSingle(),
    getCategoriesForAdmin(),
  ]);
  if (!data) notFound();

  const inv = data.inventory as unknown as {
    total_qty: number;
    reserved_qty: number;
    available_qty: number;
  } | null;

  const initial: ProductFormInitial = {
    id: data.id,
    name: data.name,
    description: data.description,
    category_id: data.category_id,
    image_url: data.image_url,
    mrp: Number(data.mrp),
    selling_price: Number(data.selling_price),
    active: data.active,
    archived: data.archived,
    tags: ((data.product_tags ?? []) as Array<{ tag: string }>).map((t) => t.tag),
    total_qty: inv?.total_qty ?? 0,
    reserved_qty: inv?.reserved_qty ?? 0,
    available_qty: inv?.available_qty ?? 0,
  };

  return (
    <div className="space-y-4">
      <nav className="text-sm text-stone-500">
        <Link href="/admin/products" className="hover:text-stone-900">
          ← Products
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{initial.name}</h1>
        {initial.archived && (
          <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
            Archived
          </span>
        )}
      </div>
      <ProductForm categories={categories} initial={initial} />
    </div>
  );
}
