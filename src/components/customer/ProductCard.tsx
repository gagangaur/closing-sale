import Link from "next/link";
import { AddToBucket } from "@/components/cart/AddToBucket";
import { PriceBlock, ProductImage, StockBadge } from "@/components/customer/ProductBits";
import type { CatalogProduct } from "@/lib/types";

export function ProductCard({
  product,
  threshold,
}: {
  product: CatalogProduct;
  threshold: number;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm">
      <Link href={`/product/${product.id}`} className="block">
        <ProductImage src={product.image_url} alt={product.name} />
        <div className="mt-2 min-h-10">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {product.name}
          </h3>
        </div>
      </Link>
      <div className="mt-1 flex min-h-5 items-center">
        <StockBadge available={product.available_qty} threshold={threshold} />
      </div>
      <div className="mt-1">
        <PriceBlock
          mrp={product.mrp}
          sellingPrice={product.selling_price}
          discountPct={product.discount_pct}
        />
      </div>
      <div className="mt-2">
        <AddToBucket product={product} />
      </div>
    </div>
  );
}
