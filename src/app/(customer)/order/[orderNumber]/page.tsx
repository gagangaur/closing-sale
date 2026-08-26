import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CopyText } from "@/components/customer/CopyText";
import { OrderSummary } from "@/components/customer/OrderSummary";
import { serviceClient } from "@/lib/supabase/service";
import type { OrderView } from "@/lib/types";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  type WhatsAppOrder,
} from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Your Order", robots: { index: false } };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" && UUID_RE.test(sp.t) ? sp.t : null;
  const justPlaced = sp.placed === "1";

  if (!token) {
    redirect(`/find-order?order=${encodeURIComponent(orderNumber)}`);
  }

  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("lookup_order", {
    p_order_number: orderNumber,
    p_token: token,
    p_phone: null,
  });

  const result = data as { ok: boolean; order?: OrderView } | null;
  if (error || !result?.ok || !result.order) {
    redirect(`/find-order?order=${encodeURIComponent(orderNumber)}`);
  }
  const order = result.order;

  // Rebuild the WhatsApp handoff server-side (number stays server-only).
  const { data: settingsRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "shop_name",
      "whatsapp_number",
      "payment_instructions",
      "collection_instructions",
    ]);
  const settingsMap = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.key, r.value])
  );
  const message = buildWhatsAppMessage(
    { ...(order as unknown as Omit<WhatsAppOrder, "applied_offer">), applied_offer: null },
    {
      shop_name: settingsMap.shop_name ?? "Closing Sale",
      payment_instructions: settingsMap.payment_instructions ?? "",
      collection_instructions: settingsMap.collection_instructions ?? "",
    }
  );
  const whatsappUrl = buildWhatsAppUrl(settingsMap.whatsapp_number ?? "", message);

  const showWhatsAppActions =
    order.status === "pending" || order.status === "confirmed";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {justPlaced && (
        <div className="rounded-2xl bg-green-600 p-4 text-white">
          <p className="text-lg font-extrabold">✅ Order placed!</p>
          <p className="mt-1 text-sm text-green-50">
            Your items are reserved. Now send the order to the shop on WhatsApp so
            they can confirm it.
          </p>
        </div>
      )}

      {showWhatsAppActions && whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 text-sm font-bold text-white shadow-sm"
        >
          Send order on WhatsApp
        </a>
      )}
      {showWhatsAppActions && <CopyText text={message} />}

      <OrderSummary order={order} />
    </div>
  );
}
