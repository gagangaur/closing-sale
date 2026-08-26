import Image from "next/image";
import { formatDiscount, formatINR } from "@/lib/format";

export function ProductImage({
  src,
  alt,
  sizes = "(max-width: 640px) 50vw, 220px",
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="flex aspect-square w-full items-center justify-center rounded-lg bg-stone-100 text-4xl"
      >
        🛍️
      </div>
    );
  }
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

export function StockBadge({
  available,
  threshold,
}: {
  available: number;
  threshold: number;
}) {
  if (available <= 0) {
    return (
      <span className="inline-block rounded bg-stone-200 px-1.5 py-0.5 text-xs font-semibold text-stone-600">
        Out of stock
      </span>
    );
  }
  if (available <= threshold) {
    return (
      <span className="inline-block rounded bg-deal-soft px-1.5 py-0.5 text-xs font-bold text-deal">
        Only {available} left
      </span>
    );
  }
  return null;
}

export function PriceBlock({
  mrp,
  sellingPrice,
  discountPct,
  size = "sm",
}: {
  mrp: number;
  sellingPrice: number;
  discountPct: number;
  size?: "sm" | "lg";
}) {
  const hasDiscount = discountPct > 0;
  return (
    <div className={size === "lg" ? "space-y-1" : ""}>
      {hasDiscount && (
        <div className="flex items-center gap-1.5">
          <span
            className={`text-stone-400 line-through ${size === "lg" ? "text-base" : "text-xs"}`}
          >
            MRP: {formatINR(mrp)}
          </span>
          <span
            className={`font-bold text-sale ${size === "lg" ? "text-base" : "text-xs"}`}
          >
            {formatDiscount(discountPct)}
          </span>
        </div>
      )}
      <div className={`font-extrabold ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        {formatINR(sellingPrice)}
      </div>
    </div>
  );
}
