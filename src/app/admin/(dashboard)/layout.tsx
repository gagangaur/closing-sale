import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getAdminUser } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

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
            <span className="hidden sm:inline">{admin.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
