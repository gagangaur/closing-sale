import Link from "next/link";
import { CartBadge } from "@/components/cart/CartBadge";

export function Header({ shopName }: { shopName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="min-w-0">
          <span className="block truncate text-base font-bold leading-tight">
            {shopName}
          </span>
          <span className="block text-xs font-extrabold uppercase tracking-widest text-sale">
            Closing Sale
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/find-order"
            className="rounded-full px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            My Order
          </Link>
          <CartBadge />
        </nav>
      </div>
    </header>
  );
}
