"use client";

import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"
    >
      Sign out
    </button>
  );
}
