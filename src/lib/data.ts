import "server-only";
import { anonServerClient } from "@/lib/supabase/anon-server";
import type {
  CatalogResult,
  CatalogSort,
  Category,
  CollectionLocation,
  OfferTier,
  PublicSettings,
} from "@/lib/types";

const SETTINGS_DEFAULTS: PublicSettings = {
  shop_name: "Closing Sale",
  sale_title: "CLOSING SALE",
  sale_message: "",
  min_order_value: 0,
  low_stock_threshold: 10,
  shop_address: "",
  shop_timings: "",
  payment_instructions: "Pay at collection. Cash preferred; UPI accepted at the shop.",
  collection_instructions: "",
  final_sale_terms: "",
  customer_notes: "",
};

export async function getPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await anonServerClient()
    .from("app_settings")
    .select("key, value")
    .eq("public", true);
  if (error || !data) return SETTINGS_DEFAULTS;

  const map = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<
    string,
    string
  >;
  return {
    ...SETTINGS_DEFAULTS,
    ...Object.fromEntries(
      Object.entries(map).filter(([k]) => k in SETTINGS_DEFAULTS)
    ),
    min_order_value: Number(map.min_order_value ?? 0) || 0,
    low_stock_threshold: Number(map.low_stock_threshold ?? 10) || 10,
  };
}

export async function searchCatalog(params: {
  query?: string;
  category?: string;
  sort?: CatalogSort;
  filter?: "low_stock" | "in_stock";
  page?: number;
  pageSize?: number;
}): Promise<CatalogResult> {
  const { data, error } = await anonServerClient().rpc("search_products", {
    p_query: params.query ?? null,
    p_category_slug: params.category ?? null,
    p_sort: params.sort ?? "newest",
    p_filter: params.filter ?? null,
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 24,
  });
  if (error) throw new Error(`Catalog search failed: ${error.message}`);
  return data as CatalogResult;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await anonServerClient()
    .from("categories")
    .select("id, name, slug")
    .eq("active", true)
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as Category[];
}

export async function getOfferTiers(): Promise<OfferTier[]> {
  const { data, error } = await anonServerClient().rpc("get_offer_tiers");
  if (error) return [];
  return (data ?? []) as OfferTier[];
}

export async function getLocations(): Promise<CollectionLocation[]> {
  const { data, error } = await anonServerClient()
    .from("locations")
    .select(
      "id, name, area, description, status, notes, collection_slots (id, slot_date, start_time, end_time, notes, active)"
    )
    .neq("status", "disabled")
    .eq("archived", false)
    .order("sort_order");
  if (error || !data) return [];
  return data.map((l) => ({
    ...l,
    collection_slots: ((l.collection_slots ?? []) as Array<
      CollectionLocation["collection_slots"][number] & { active: boolean }
    >)
      .filter((s) => s.active)
      .sort((a, b) => (a.slot_date < b.slot_date ? -1 : 1)),
  })) as CollectionLocation[];
}
