// Shared types across the customer site, API routes and admin.

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  mrp: number;
  selling_price: number;
  discount_pct: number;
  category_name: string | null;
  category_slug: string | null;
  available_qty: number;
  units_ordered: number;
};

export type CatalogResult = {
  items: CatalogProduct[];
  total: number;
  page: number;
  page_size: number;
  low_stock_threshold: number;
};

export type CatalogSort = "newest" | "price_asc" | "price_desc" | "popularity";

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type OfferTier = {
  id: string;
  name: string;
  threshold: number;
  free_qty: number;
  free_product_id: string;
  free_product_name: string;
  free_product_image: string | null;
  in_stock: boolean;
};

export type CollectionSlot = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

export type CollectionLocation = {
  id: string;
  name: string;
  area: string;
  description: string;
  status: "confirmed" | "coming_soon";
  notes: string;
  collection_slots: CollectionSlot[];
};

export type PublicSettings = {
  shop_name: string;
  sale_title: string;
  sale_subtitle: string;
  sale_message: string;
  legacy_badge: string;
  thank_you_message: string;
  sale_days: string;
  min_order_value: number;
  low_stock_threshold: number;
  shop_address: string;
  shop_timings: string;
  payment_instructions: string;
  collection_instructions: string;
  final_sale_terms: string;
  customer_notes: string;
};

export type CartItem = {
  id: string;
  name: string;
  image_url: string | null;
  mrp: number;
  selling_price: number;
  discount_pct: number;
  available_qty: number; // snapshot at add time; server revalidates
  quantity: number;
};

export type OrderItemView = {
  product_name: string;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  mrp: number;
  discount_pct: number;
  line_total: number;
  is_free: boolean;
};

export type OrderView = {
  order_number: string;
  status: "pending" | "confirmed" | "ready" | "collected" | "cancelled" | "expired";
  customer_name: string;
  customer_phone: string;
  location: Record<string, unknown>;
  slot: Record<string, unknown> | null;
  is_other_location: boolean;
  note: string;
  subtotal: number;
  total: number;
  item_count: number;
  created_at: string;
  items: OrderItemView[];
};

export const ORDER_STATUS_LABELS: Record<OrderView["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready for Collection",
  collected: "Collected",
  cancelled: "Cancelled",
  expired: "Expired",
};
