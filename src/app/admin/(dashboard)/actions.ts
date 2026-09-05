"use server";

import { revalidatePath } from "next/cache";
import { authServerClient, getAdminUser } from "@/lib/supabase/server-auth";
import { serviceClient } from "@/lib/supabase/service";

/**
 * Admin server actions. Defense in depth:
 *  1. every action verifies the caller is an admin (getAdminUser),
 *  2. queries run with the caller's JWT so RLS applies,
 *  3. sensitive mutations go through SECURITY DEFINER RPCs that re-check
 *     authorization and write audit records.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");
  return admin;
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ---------------- products ----------------

export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  category_id: string | null;
  new_category?: string;
  mrp: number;
  selling_price: number;
  active: boolean;
  tags: string[];
};

export async function saveProduct(
  input: ProductInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const supabase = await authServerClient();

  const name = input.name?.trim() ?? "";
  const mrp = Math.round(Number(input.mrp) * 100) / 100;
  const price = Math.round(Number(input.selling_price) * 100) / 100;

  if (name.length < 2) return fail("Product name must be at least 2 characters.");
  if (!Number.isFinite(mrp) || mrp <= 0) return fail("MRP must be a positive amount.");
  if (!Number.isFinite(price) || price <= 0)
    return fail("Selling price must be a positive amount.");
  if (price > mrp) return fail("Selling price cannot be higher than MRP.");

  let categoryId = input.category_id;
  const newCategory = input.new_category?.trim();
  if (newCategory) {
    const slug = newCategory
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", newCategory)
      .maybeSingle();
    if (existing) {
      categoryId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("categories")
        .insert({ name: newCategory, slug, sort_order: 100 })
        .select("id")
        .single();
      if (error) return fail(`Could not create category: ${error.message}`);
      categoryId = created.id;
    }
  }

  const row = {
    name,
    description: input.description?.trim() ?? "",
    category_id: categoryId,
    mrp,
    selling_price: price,
    active: Boolean(input.active),
  };

  let productId = input.id;
  if (productId) {
    const { error } = await supabase.from("products").update(row).eq("id", productId);
    if (error) return fail(`Could not save product: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert(row)
      .select("id")
      .single();
    if (error) return fail(`Could not create product: ${error.message}`);
    productId = data.id as string;
  }

  // replace tags
  const tags = [
    ...new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean)),
  ].slice(0, 30);
  await supabase.from("product_tags").delete().eq("product_id", productId);
  if (tags.length > 0) {
    const { error } = await supabase
      .from("product_tags")
      .insert(tags.map((tag) => ({ product_id: productId, tag })));
    if (error) return fail(`Product saved, but tags failed: ${error.message}`);
  }

  revalidatePath("/admin/products");
  return { ok: true, data: { id: productId } };
}

export async function setProductArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  // archived products are also deactivated so they never show in the catalog
  const { error } = await supabase
    .from("products")
    .update(archived ? { archived: true, active: false } : { archived: false })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/products");
  return { ok: true };
}

const BUCKET = "product-images";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadProductImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();

  const productId = String(formData.get("product_id") ?? "");
  const file = formData.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !(file instanceof File)) {
    return fail("Invalid upload.");
  }
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return fail("Please upload a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024) return fail("Image must be smaller than 5 MB.");

  // storage write uses the service client (bucket policies may not exist);
  // admin identity was verified above
  const service = serviceClient();

  // The bucket must be PUBLIC or the image URLs we store will 404 for
  // customers. Create it if missing and repair visibility if someone made
  // it private in the dashboard.
  const { data: bucket } = await service.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await service.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: Object.keys(IMAGE_TYPES),
    });
    if (error) return fail(`Could not create the image bucket: ${error.message}`);
  } else if (!bucket.public) {
    const { error } = await service.storage.updateBucket(BUCKET, { public: true });
    if (error) return fail(`Image bucket is private and could not be fixed: ${error.message}`);
  }

  const path = `${productId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: true,
    });
  if (uploadError) {
    return fail(`Upload failed: ${uploadError.message}`);
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const supabase = await authServerClient();
  const { error } = await supabase
    .from("products")
    .update({ image_url: url })
    .eq("id", productId);
  if (error) return fail(`Image uploaded but could not be linked: ${error.message}`);

  revalidatePath("/admin/products");
  return { ok: true, data: { url } };
}

// ---------------- inventory ----------------

export async function adjustInventory(
  productId: string,
  mode: "set" | "increase" | "decrease",
  qty: number,
  reason: string
): Promise<ActionResult<{ total_qty: number; reserved_qty: number; available_qty: number }>> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { data, error } = await supabase.rpc("adjust_inventory", {
    p_product_id: productId,
    p_mode: mode,
    p_qty: Math.trunc(qty),
    p_reason: reason?.slice(0, 300) ?? "",
  });
  if (error) return fail(error.message);
  const result = data as
    | { ok: true; total_qty: number; reserved_qty: number; available_qty: number }
    | { ok: false; message: string };
  if (!result.ok) return fail(result.message);
  revalidatePath("/admin/inventory");
  return { ok: true, data: result };
}

// ---------------- orders ----------------

export async function changeOrderStatus(
  orderId: string,
  newStatus: "confirmed" | "ready" | "collected" | "cancelled" | "expired",
  note: string
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_note: note?.slice(0, 300) ?? "",
  });
  if (error) return fail(error.message);
  const result = data as { ok: boolean; message?: string };
  if (!result.ok) return fail(result.message ?? "Could not update the order.");
  revalidatePath("/admin/orders");
  return { ok: true };
}

// ---------------- offers ----------------

export type OfferInput = {
  id?: string;
  name: string;
  threshold: number;
  free_product_id: string;
  free_qty: number;
  priority: number;
  active: boolean;
};

export async function saveOffer(input: OfferInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();

  const threshold = Math.round(Number(input.threshold) * 100) / 100;
  const freeQty = Math.trunc(Number(input.free_qty));
  if (!input.name?.trim()) return fail("Offer name is required.");
  if (!Number.isFinite(threshold) || threshold <= 0)
    return fail("Threshold must be a positive amount.");
  if (!Number.isInteger(freeQty) || freeQty < 1)
    return fail("Free quantity must be at least 1.");

  // the free product must exist, be sellable and have stock
  const { data: product } = await supabase
    .from("products")
    .select("id, name, active, archived, inventory (available_qty)")
    .eq("id", input.free_product_id)
    .maybeSingle();
  if (!product) return fail("Select a valid free product.");
  if (!product.active || product.archived)
    return fail("The free product must be an active (non-archived) product.");
  const inv = product.inventory as unknown as { available_qty: number } | null;
  if ((inv?.available_qty ?? 0) < freeQty)
    return fail(
      `Not enough stock of "${product.name}" to promise as a gift (available: ${inv?.available_qty ?? 0}).`
    );

  const row = {
    name: input.name.trim(),
    threshold,
    free_product_id: input.free_product_id,
    free_qty: freeQty,
    priority: Math.trunc(Number(input.priority)) || 0,
    active: Boolean(input.active),
  };

  const { error } = input.id
    ? await supabase.from("offers").update(row).eq("id", input.id)
    : await supabase.from("offers").insert(row);
  if (error) return fail(error.message);

  revalidatePath("/admin/offers");
  return { ok: true };
}

export async function setOfferArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { error } = await supabase
    .from("offers")
    .update(archived ? { archived: true, active: false } : { archived: false })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/offers");
  return { ok: true };
}

// ---------------- locations & slots ----------------

export type LocationInput = {
  id?: string;
  name: string;
  area: string;
  description: string;
  status: "confirmed" | "coming_soon" | "disabled";
  notes: string;
  sort_order: number;
};

export async function saveLocation(input: LocationInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const supabase = await authServerClient();
  if (!input.name?.trim()) return fail("Location name is required.");

  const row = {
    name: input.name.trim(),
    area: input.area?.trim() ?? "",
    description: input.description?.trim() ?? "",
    status: input.status,
    notes: input.notes?.trim() ?? "",
    sort_order: Math.trunc(Number(input.sort_order)) || 0,
  };

  if (input.id) {
    const { error } = await supabase.from("locations").update(row).eq("id", input.id);
    if (error) return fail(error.message);
    revalidatePath("/admin/locations");
    return { ok: true, data: { id: input.id } };
  }
  const { data, error } = await supabase
    .from("locations")
    .insert(row)
    .select("id")
    .single();
  if (error) return fail(error.message);
  revalidatePath("/admin/locations");
  return { ok: true, data: { id: data.id as string } };
}

export async function setLocationArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { error } = await supabase
    .from("locations")
    .update(archived ? { archived: true, status: "disabled" } : { archived: false })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/locations");
  return { ok: true };
}

export type SlotInput = {
  id?: string;
  location_id: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  active: boolean;
  notes: string;
};

export async function saveSlot(input: SlotInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.slot_date)) return fail("Pick a valid date.");
  if (!input.start_time || !input.end_time) return fail("Pick start and end times.");
  if (input.end_time <= input.start_time)
    return fail("End time must be after start time.");

  const row = {
    location_id: input.location_id,
    slot_date: input.slot_date,
    start_time: input.start_time,
    end_time: input.end_time,
    active: Boolean(input.active),
    notes: input.notes?.trim() ?? "",
  };
  const { error } = input.id
    ? await supabase.from("collection_slots").update(row).eq("id", input.id)
    : await supabase.from("collection_slots").insert(row);
  if (error) return fail(error.message);
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function deleteSlot(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { error } = await supabase.from("collection_slots").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/locations");
  return { ok: true };
}

// ---------------- settings ----------------

const EDITABLE_SETTINGS = new Set([
  "shop_name",
  "sale_title",
  "sale_subtitle",
  "sale_message",
  "legacy_badge",
  "thank_you_message",
  "sale_days",
  "min_order_value",
  "low_stock_threshold",
  "shop_address",
  "shop_timings",
  "payment_instructions",
  "collection_instructions",
  "final_sale_terms",
  "customer_notes",
  "whatsapp_number",
]);

export async function saveSettings(
  entries: Array<{ key: string; value: string }>
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await authServerClient();

  for (const { key, value } of entries) {
    if (!EDITABLE_SETTINGS.has(key)) continue;
    let v = value.trim();
    if (key === "min_order_value" || key === "low_stock_threshold") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0)
        return fail(`"${key.replaceAll("_", " ")}" must be a number, zero or more.`);
      v = String(n);
    }
    if (key === "whatsapp_number") {
      v = v.replace(/[^0-9]/g, "");
      if (v !== "" && (v.length < 10 || v.length > 15))
        return fail("WhatsApp number must be 10–15 digits including country code.");
    }
    const { error } = await supabase
      .from("app_settings")
      .update({ value: v })
      .eq("key", key);
    if (error) return fail(`Could not save "${key}": ${error.message}`);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true };
}

// ---------------- bulk import ----------------

export type ImportRow = {
  name: string;
  description: string;
  category: string;
  tags: string[];
  mrp: string;
  selling_price: string;
  quantity: string;
  active: string;
};

export type ImportReport =
  | { ok: true; dry_run: boolean; valid_rows?: number; imported?: number }
  | { ok: false; errors: Array<{ row: number; name?: string; errors: string[] }> };

export async function bulkImportProducts(
  rows: ImportRow[],
  dryRun: boolean
): Promise<ImportReport> {
  await requireAdmin();
  const supabase = await authServerClient();
  const { data, error } = await supabase.rpc("bulk_import_products", {
    p_rows: rows,
    p_dry_run: dryRun,
  });
  if (error) {
    return { ok: false, errors: [{ row: 0, errors: [error.message] }] };
  }
  if (!dryRun) revalidatePath("/admin/products");
  return data as ImportReport;
}
