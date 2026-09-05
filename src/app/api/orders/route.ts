import { NextResponse } from "next/server";
import { DEFAULT_SHOP_NAME } from "@/lib/branding";
import { serviceClient } from "@/lib/supabase/service";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  type WhatsAppOrder,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type OrderPayload = {
  customer?: { name?: unknown; phone?: unknown };
  items?: unknown;
  location_id?: unknown;
  slot_id?: unknown;
  is_other_location?: unknown;
  note?: unknown;
  expected_offer_id?: unknown;
  idempotency_key?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, code: "INVALID_INPUT", message },
    { status }
  );
}

async function getOrderSettings() {
  const { data } = await serviceClient()
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "shop_name",
      "whatsapp_number",
      "payment_instructions",
      "collection_instructions",
    ]);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    shop_name: map.shop_name ?? DEFAULT_SHOP_NAME,
    whatsapp_number: map.whatsapp_number ?? "",
    payment_instructions: map.payment_instructions ?? "",
    collection_instructions: map.collection_instructions ?? "",
  };
}

export async function POST(request: Request) {
  let body: OrderPayload;
  try {
    body = (await request.json()) as OrderPayload;
  } catch {
    return bad("Invalid request.");
  }

  // Light shape validation — authoritative validation (prices, stock,
  // offers, minimum order) happens atomically inside place_order.
  if (typeof body.idempotency_key !== "string" || !UUID_RE.test(body.idempotency_key)) {
    return bad("Invalid request.");
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 200) {
    return bad("Your bucket is empty or invalid.");
  }
  for (const item of body.items as Array<{ product_id?: unknown; quantity?: unknown }>) {
    if (
      typeof item?.product_id !== "string" ||
      !UUID_RE.test(item.product_id) ||
      typeof item?.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999
    ) {
      return bad("Your bucket contains invalid items.");
    }
  }

  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_input: {
      customer: {
        name: typeof body.customer?.name === "string" ? body.customer.name : "",
        phone: typeof body.customer?.phone === "string" ? body.customer.phone : "",
      },
      items: body.items,
      location_id:
        typeof body.location_id === "string" && UUID_RE.test(body.location_id)
          ? body.location_id
          : null,
      slot_id:
        typeof body.slot_id === "string" && UUID_RE.test(body.slot_id)
          ? body.slot_id
          : null,
      is_other_location: body.is_other_location === true,
      note: typeof body.note === "string" ? body.note : "",
      expected_offer_id:
        typeof body.expected_offer_id === "string" && UUID_RE.test(body.expected_offer_id)
          ? body.expected_offer_id
          : null,
      idempotency_key: body.idempotency_key,
    },
  });

  if (error) {
    console.error("place_order failed:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: "Could not place your order right now. Please try again in a moment.",
      },
      { status: 500 }
    );
  }

  const result = data as {
    ok: boolean;
    duplicate?: boolean;
    code?: string;
    message?: string;
    items?: unknown[];
    applied_offer?: unknown;
    order?: {
      order_number: string;
      access_token: string;
      [key: string]: unknown;
    };
  };

  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }

  // Order is persisted — now build the WhatsApp handoff (communication only).
  const settings = await getOrderSettings();
  let whatsappUrl: string | null = null;

  try {
    if (result.duplicate && result.order) {
      // Double submit: rebuild the message from the stored order.
      const { data: lookup } = await supabase.rpc("lookup_order", {
        p_order_number: result.order.order_number,
        p_token: result.order.access_token,
        p_phone: null,
      });
      const lk = lookup as { ok: boolean; order?: Omit<WhatsAppOrder, "applied_offer"> };
      if (lk?.ok && lk.order) {
        const message = buildWhatsAppMessage(
          { ...lk.order, applied_offer: null },
          settings
        );
        whatsappUrl = buildWhatsAppUrl(settings.whatsapp_number, message);
      }
    } else if (result.order) {
      const message = buildWhatsAppMessage(
        result.order as unknown as WhatsAppOrder,
        settings
      );
      whatsappUrl = buildWhatsAppUrl(settings.whatsapp_number, message);
    }
  } catch (e) {
    // Never fail the order because message building failed.
    console.error("whatsapp message build failed:", e);
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate === true,
    order: {
      order_number: result.order?.order_number,
      access_token: result.order?.access_token,
    },
    whatsapp_url: whatsappUrl,
  });
}
