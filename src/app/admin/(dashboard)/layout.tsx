import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getAdminUser } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * Every page under /admin (except /admin/login) is server-side guarded:
 * a valid session AND a row in admin_users are both required.
 * RLS enforces the same on every query — this guard is UX, not the security boundary.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-bold">
            Closing Sale <span className="text-sale">Admin</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Link
              href="/"
              className="hidden rounded-lg px-2 py-1.5 font-medium hover:text-stone-900 sm:inline"
            >
              View shop ↗
            </Link>
            <span className="hidden md:inline">{admin.user.email}</span>
            <SignOutButton />
          </div>
        </div>
        <nav className="scroll-row mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
