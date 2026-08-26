"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client (anon key). Used by the admin login flow. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
