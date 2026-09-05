import { ProductCard } from "@/components/customer/ProductCard";
import type { CatalogProduct } from "@/lib/types";

/** Horizontal scrolling product row for discovery sections. */
export function SectionRow({
  title,
  subtitle,
  products,
  threshold,
  accent = false,
}: {
  title: string;
  subtitle?: string;
  products: CatalogProduct[];
  threshold: number;
  accent?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className={`text-lg font-bold ${accent ? "text-navy" : ""}`}>{title}</h2>
        {subtitle && <span className="text-xs text-stone-500">{subtitle}</span>}
      </div>
      <div className="scroll-row -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
            <ProductCard product={p} threshold={threshold} />
          </div>
        ))}
      </div>
    </section>
  );
}
