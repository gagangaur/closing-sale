import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Customer order lookup: Order ID + the phone number used on the order.
 * Never exposes other customers' orders.
 */
export async function POST(request: Request) {
  let body: { order_number?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_INPUT", message: "Invalid request." },
      { status: 400 }
    );
  }

  const orderNumber =
    typeof body.order_number === "string" ? body.order_number.trim().slice(0, 30) : "";
  const phone = typeof body.phone === "string" ? body.phone.slice(0, 20) : "";

  if (!orderNumber || !phone) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_INPUT",
        message: "Please enter your Order ID and the phone number used on the order.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await serviceClient().rpc("lookup_order", {
    p_order_number: orderNumber,
    p_token: null,
    p_phone: phone,
  });

  if (error) {
    console.error("lookup_order failed:", error);
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR", message: "Could not look up the order right now." },
      { status: 500 }
    );
  }

  const result = data as { ok: boolean };
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
