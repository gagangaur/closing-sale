import Link from "next/link";
import { CartBadge } from "@/components/cart/CartBadge";

export function Header({ shopName }: { shopName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="min-w-0">
          <span className="block text-sm font-bold leading-tight sm:text-base">
            {shopName}
          </span>
          <span className="block text-[11px] font-extrabold uppercase tracking-widest text-navy">
            Closing Sale
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/find-order"
            className="rounded-full px-2.5 py-2 text-sm font-medium text-stone-600 hover:text-navy sm:px-3"
          >
            My Order
          </Link>
          <CartBadge />
        </nav>
      </div>
    </header>
  );
}
