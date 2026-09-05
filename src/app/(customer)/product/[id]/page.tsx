import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToBucket } from "@/components/cart/AddToBucket";
import { PriceBlock, ProductImage, StockBadge } from "@/components/customer/ProductBits";
import { getPublicSettings } from "@/lib/data";
import { anonServerClient } from "@/lib/supabase/anon-server";
import type { CatalogProduct } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [{ data, error }, settings] = await Promise.all([
    anonServerClient()
      .from("products")
      .select(
        "id, name, description, image_url, mrp, selling_price, discount_pct, categories (name, slug), inventory (available_qty), product_tags (tag)"
      )
      .eq("id", id)
      .maybeSingle(),
    getPublicSettings(),
  ]);

  if (error || !data) notFound();

  // Supabase types nested relations as arrays; at runtime these are objects
  // (many-to-one and one-to-one relationships).
  const category = data.categories as unknown as { name: string; slug: string } | null;
  const inventory = data.inventory as unknown as { available_qty: number } | null;
  const tags = ((data.product_tags ?? []) as Array<{ tag: string }>).map((t) => t.tag);

  const product: CatalogProduct = {
    id: data.id,
    name: data.name,
    description: data.description,
    image_url: data.image_url,
    mrp: Number(data.mrp),
    selling_price: Number(data.selling_price),
    discount_pct: Number(data.discount_pct),
    category_name: category?.name ?? null,
    category_slug: category?.slug ?? null,
    available_qty: inventory?.available_qty ?? 0,
    units_ordered: 0,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav className="text-sm text-stone-500">
        <Link href="/" className="hover:text-stone-900">
          ← Back to sale
        </Link>
        {product.category_name && (
          <>
            {" · "}
            <Link
              href={`/?category=${product.category_slug}`}
              className="hover:text-stone-900"
            >
              {product.category_name}
            </Link>
          </>
        )}
      </nav>

      <ProductImage
        src={product.image_url}
        alt={product.name}
        sizes="(max-width: 640px) 100vw, 640px"
        priority
      />

      <div className="space-y-2">
        <h1 className="text-xl font-bold leading-snug">{product.name}</h1>
        <StockBadge
          available={product.available_qty}
          threshold={settings.low_stock_threshold}
        />
        <PriceBlock
          mrp={product.mrp}
          sellingPrice={product.selling_price}
          discountPct={product.discount_pct}
          size="lg"
        />
      </div>

      <AddToBucket product={product} size="lg" />

      {product.description && (
        <section>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-stone-500">
            Details
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">
            {product.description}
          </p>
        </section>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Link
              key={t}
              href={`/?q=${encodeURIComponent(t)}`}
              className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      <p className="rounded-xl bg-navy-soft px-3 py-2 text-xs leading-relaxed text-stone-700">
        Closing sale item — final sale. Inspect before accepting at collection. No
        returns or exchanges after purchase. {settings.payment_instructions}
      </p>
    </div>
  );
}
