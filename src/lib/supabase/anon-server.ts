import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Anonymous client for server components reading PUBLIC catalog data
 * (products, categories, offers, locations, public settings). Subject to RLS.
 */
let cached: SupabaseClient | null = null;

export function anonServerClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
