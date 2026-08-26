import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Cookie-based client for the ADMIN area (server components & route handlers).
 * Carries the signed-in admin's session; subject to RLS.
 */
export async function authServerClient() {
  const cookieStore = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore; the proxy or a
          // route handler will refresh the session cookie instead.
        }
      },
    },
  });
}

/** Returns the signed-in user if (and only if) they are an admin. */
export async function getAdminUser() {
  const supabase = await authServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? { user, role: data.role as string } : null;
}
