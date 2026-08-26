import "server-only";
import { authServerClient } from "@/lib/supabase/server-auth";
import type { Category } from "@/lib/types";

/** Categories for admin forms — includes inactive ones. */
export async function getCategoriesForAdmin(): Promise<Category[]> {
  const supabase = await authServerClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");
  return (data ?? []) as Category[];
}

/** Active, non-archived products for pickers (offers, etc.). */
export async function getProductPickerList(): Promise<
  Array<{ id: string; name: string; available_qty: number }>
> {
  const supabase = await authServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, inventory (available_qty)")
    .eq("active", true)
    .eq("archived", false)
    .order("name");
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    inventory: { available_qty: number } | null;
  }>).map((p) => ({
    id: p.id,
    name: p.name,
    available_qty: p.inventory?.available_qty ?? 0,
  }));
}
