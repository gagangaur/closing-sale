import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { authServerClient, getAdminUser } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

/**
 * Orders CSV export — one row per order item. Admin only.
 * Never includes secrets, tokens or internal keys.
 */
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();

  const supabase = await authServerClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, created_at, customer_name, customer_phone, status, total, customer_note, is_other_location, location_snapshot, slot_snapshot, order_items (product_name, quantity, unit_price, mrp, discount_pct, line_total, is_free)"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (status) query = query.eq("status", status);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (q) {
    query = query.or(
      `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const header = [
    "Order ID",
    "Placed At",
    "Customer Name",
    "Customer Phone",
    "Collection Location",
    "Collection Date",
    "Collection Time",
    "Status",
    "Product",
    "Quantity",
    "Unit Price",
    "MRP",
    "Discount %",
    "Free Item",
    "Line Total",
    "Order Total",
    "Customer Note",
  ];

  const rows: Array<Array<string | number>> = [header];

  for (const order of data ?? []) {
    const loc = (order.location_snapshot ?? {}) as {
      name?: string;
      area?: string;
      shop_address?: string;
    };
    const slot = order.slot_snapshot as {
      slot_date?: string;
      start_time?: string;
      end_time?: string;
    } | null;
    const locationLabel = order.is_other_location
      ? `Shop pickup${loc.shop_address ? ` (${loc.shop_address})` : ""}`
      : [loc.name, loc.area].filter(Boolean).join(", ");

    const items = (order.order_items ?? []) as Array<{
      product_name: string;
      quantity: number;
      unit_price: number;
      mrp: number;
      discount_pct: number;
      line_total: number;
      is_free: boolean;
    }>;

    for (const item of items) {
      rows.push([
        order.order_number,
        new Date(order.created_at).toLocaleString("en-IN"),
        order.customer_name,
        order.customer_phone,
        locationLabel,
        slot?.slot_date ?? "",
        slot?.start_time && slot?.end_time ? `${slot.start_time}–${slot.end_time}` : "",
        order.status,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.mrp,
        item.discount_pct,
        item.is_free ? "YES" : "NO",
        item.line_total,
        order.total,
        order.customer_note ?? "",
      ]);
    }
  }

  const csv = "﻿" + toCsv(rows); // BOM so Excel opens UTF-8 (₹, names) correctly
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${stamp}.csv"`,
    },
  });
}
