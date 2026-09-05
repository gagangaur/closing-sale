"use client";

import { useState, useSyncExternalStore } from "react";
import { POLICY_LINE } from "@/lib/branding";
import { formatINR } from "@/lib/format";
import type { PublicSettings } from "@/lib/types";
import { buildShareMessage, buildShareUrl } from "@/lib/whatsapp";

// The site URL is only known in the browser; the server snapshot omits it so
// SSR and hydration agree, then the client re-renders with the real origin.
const noopSubscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => undefined;

/**
 * Screenshot-friendly summary card + "Share on WhatsApp" (no recipient —
 * WhatsApp opens its contact picker) and a copy fallback.
 */
export function ShareSale({ settings }: { settings: PublicSettings }) {
  const siteUrl = useSyncExternalStore(noopSubscribe, getOrigin, getServerOrigin);
  const [copied, setCopied] = useState(false);

  const message = buildShareMessage(settings, siteUrl);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the WhatsApp button still works
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 text-ink shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-navy">
        Share this sale
      </p>
      <p className="mt-1 text-base font-extrabold leading-snug">
        {settings.shop_name} — {settings.sale_title}
      </p>
      <p className="text-sm font-bold text-cta-dark">
        {settings.sale_subtitle} · Limited stock
      </p>
      <p className="mt-1 inline-block rounded bg-gold-soft px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-gold-dark">
        {settings.sale_days}
      </p>
      <ul className="mt-2 space-y-0.5 text-sm text-stone-700">
        {settings.shop_address && <li>📍 {settings.shop_address}</li>}
        {settings.shop_timings && <li>🕒 {settings.shop_timings}</li>}
        <li>
          🤝 Reserve online, collect &amp; pay at pickup
          {settings.min_order_value > 0 && ` · Minimum order ${formatINR(settings.min_order_value)}`}
        </li>
      </ul>
      <p className="mt-2 border-t border-stone-100 pt-2 text-xs leading-relaxed text-stone-600">
        {POLICY_LINE}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={buildShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-cta px-4 text-sm font-bold text-white shadow-sm active:scale-95"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5.2 5.2 0 0 0 3.1.6 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
          </svg>
          Share on WhatsApp
        </a>
        <button
          onClick={copy}
          className="h-10 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-700"
        >
          {copied ? "Copied ✓" : "Copy message"}
        </button>
      </div>
    </div>
  );
}
