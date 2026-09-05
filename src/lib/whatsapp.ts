import { POLICY_LINE } from "@/lib/branding";
import { formatINR, formatSlotDate, formatSlotTime } from "@/lib/format";
import type { PublicSettings } from "@/lib/types";

export type WhatsAppOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  location: Record<string, unknown>;
  slot: Record<string, unknown> | null;
  note: string;
  subtotal: number;
  total: number;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    mrp: number;
    line_total: number;
    is_free: boolean;
  }>;
  applied_offer: { name: string; free_product_name: string; free_qty: number } | null;
};

/** Human-readable order message, generated from the persisted order. */
export function buildWhatsAppMessage(
  order: WhatsAppOrder,
  settings: { shop_name: string; payment_instructions: string; collection_instructions: string }
): string {
  const lines: string[] = [];
  lines.push(`*New Closing Sale Order — ${settings.shop_name}*`);
  lines.push("");
  lines.push(`*Order ID:* ${order.order_number}`);
  lines.push(`*Name:* ${order.customer_name}`);
  lines.push(`*Phone:* ${order.customer_phone}`);

  const loc = order.location as {
    type?: string;
    name?: string;
    area?: string;
    shop_address?: string;
    shop_timings?: string;
  };
  if (loc.type === "other") {
    lines.push(`*Collection:* Shop pickup`);
    if (loc.shop_address) lines.push(`*Address:* ${loc.shop_address}`);
    if (loc.shop_timings) lines.push(`*Timings:* ${loc.shop_timings}`);
  } else {
    lines.push(`*Collection:* ${loc.name ?? ""}${loc.area ? `, ${loc.area}` : ""}`);
    const slot = order.slot as {
      slot_date?: string;
      start_time?: string;
      end_time?: string;
    } | null;
    if (slot?.slot_date && slot.start_time && slot.end_time) {
      lines.push(
        `*When:* ${formatSlotDate(slot.slot_date)}, ${formatSlotTime(
          slot.start_time
        )} – ${formatSlotTime(slot.end_time)}`
      );
    }
  }

  lines.push("");
  lines.push("*Items:*");
  for (const item of order.items) {
    if (item.is_free) {
      lines.push(`• ${item.product_name} x${item.quantity} — FREE 🎁`);
    } else {
      const discount =
        item.mrp > item.unit_price
          ? ` (MRP ${formatINR(item.mrp)})`
          : "";
      lines.push(
        `• ${item.product_name} x${item.quantity} @ ${formatINR(item.unit_price)}${discount} = ${formatINR(item.line_total)}`
      );
    }
  }

  lines.push("");
  lines.push(`*Subtotal:* ${formatINR(order.subtotal)}`);
  if (order.applied_offer) {
    lines.push(
      `*Free gift:* ${order.applied_offer.free_product_name} x${order.applied_offer.free_qty} (${order.applied_offer.name})`
    );
  }
  lines.push(`*Total payable at collection:* ${formatINR(order.total)}`);
  lines.push("");
  if (order.note) {
    lines.push(`*Customer note:* ${order.note}`);
    lines.push("");
  }
  if (settings.payment_instructions) lines.push(settings.payment_instructions);
  if (settings.collection_instructions) lines.push(settings.collection_instructions);
  lines.push("_Final sale — no returns or exchanges. Order cannot be modified after placement._");

  return lines.join("\n");
}

/** wa.me deep link. Number must be digits only, with country code. */
export function buildWhatsAppUrl(whatsappNumber: string, message: string): string | null {
  const digits = whatsappNumber.replace(/[^0-9]/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Forwardable announcement for customers to share (no recipient — WhatsApp
 * opens its contact picker). Short, no percentages, policy line verbatim.
 */
export function buildShareMessage(
  settings: Pick<
    PublicSettings,
    | "shop_name"
    | "sale_title"
    | "sale_subtitle"
    | "sale_message"
    | "thank_you_message"
    | "sale_days"
    | "shop_address"
    | "shop_timings"
    | "min_order_value"
  >,
  siteUrl?: string
): string {
  const lines: string[] = [];
  lines.push(`*${settings.shop_name} — ${settings.sale_title}*`);
  if (settings.sale_message) lines.push(settings.sale_message);
  if (settings.thank_you_message) lines.push(`_${settings.thank_you_message}_`);
  lines.push("");
  lines.push(`*${settings.sale_subtitle}* · Limited stock`);
  lines.push(`*${settings.sale_days}*`);
  if (settings.shop_address) lines.push(`📍 ${settings.shop_address}`);
  if (settings.shop_timings) lines.push(`🕒 ${settings.shop_timings}`);
  lines.push("");
  lines.push(
    `Reserve online, collect & pay at pickup${
      settings.min_order_value > 0 ? ` · Minimum order ${formatINR(settings.min_order_value)}` : ""
    }`
  );
  if (siteUrl) lines.push(siteUrl);
  lines.push("");
  lines.push(POLICY_LINE);
  return lines.join("\n");
}

/** Share link without a recipient — WhatsApp asks who to send it to. */
export function buildShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
