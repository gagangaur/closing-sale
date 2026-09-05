"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartContext";
import { formatINR, formatSlotDate, formatSlotTime } from "@/lib/format";
import type {
  CollectionLocation,
  OfferTier,
  PublicSettings,
} from "@/lib/types";

type ShortageItem = { product_id: string; name: string; requested: number; available: number };

type PlaceOrderResponse =
  | {
      ok: true;
      duplicate?: boolean;
      order: { order_number: string; access_token: string };
      whatsapp_url: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      items?: ShortageItem[];
    };

export function BucketClient({
  settings,
  tiers,
  locations,
}: {
  settings: PublicSettings;
  tiers: OfferTier[];
  locations: CollectionLocation[];
}) {
  const router = useRouter();
  const cart = useCart();
  const { items, subtotal, hydrated } = cart;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationChoice, setLocationChoice] = useState<string>(""); // location id or "other"
  const [slotChoice, setSlotChoice] = useState<string>("");
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shortages, setShortages] = useState<ShortageItem[]>([]);

  // Idempotency: stable across double-clicks, new key when the bucket changes.
  const idemKeyRef = useRef<string>("");
  const cartSignature = useMemo(
    () => items.map((i) => `${i.id}:${i.quantity}`).join(","),
    [items]
  );
  useEffect(() => {
    idemKeyRef.current = crypto.randomUUID();
  }, [cartSignature]);

  const confirmedLocations = locations.filter((l) => l.status === "confirmed");
  const comingSoonLocations = locations.filter((l) => l.status === "coming_soon");
  const selectedLocation = confirmedLocations.find((l) => l.id === locationChoice);

  // keep slot choice in sync with the selected location (settles in one pass)
  const desiredSlot = selectedLocation
    ? selectedLocation.collection_slots.some((s) => s.id === slotChoice)
      ? slotChoice
      : selectedLocation.collection_slots[0]?.id ?? ""
    : "";
  if (desiredSlot !== slotChoice) {
    setSlotChoice(desiredSlot);
  }

  const minOrder = settings.min_order_value;
  const belowMin = subtotal < minOrder;
  const remainingToMin = Math.max(0, Math.round((minOrder - subtotal) * 100) / 100);

  const eligible = cart.eligibleTier(tiers);
  const nextTier = tiers
    .filter((t) => t.in_stock && t.threshold > subtotal)
    .sort((a, b) => a.threshold - b.threshold)[0];

  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 15;
  const nameValid = name.trim().length >= 2;
  const locationValid =
    locationChoice === "other" || Boolean(selectedLocation);

  const canSubmit =
    hydrated &&
    items.length > 0 &&
    !belowMin &&
    nameValid &&
    phoneValid &&
    locationValid &&
    agreed &&
    !submitting;

  async function placeOrder() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    setShortages([]);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: name.trim(), phone: phoneDigits },
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          is_other_location: locationChoice === "other",
          location_id: locationChoice === "other" ? null : locationChoice,
          slot_id: slotChoice || null,
          note: note.trim(),
          expected_offer_id: eligible?.id ?? null,
          idempotency_key: idemKeyRef.current,
        }),
      });
      const data = (await res.json()) as PlaceOrderResponse;

      if (data.ok) {
        // Order is safely persisted — WhatsApp is only communication.
        cart.clear();
        if (data.whatsapp_url) {
          try {
            window.open(data.whatsapp_url, "_blank", "noopener");
          } catch {
            // popup blocked — confirmation page has an Open WhatsApp button
          }
        }
        router.replace(
          `/order/${data.order.order_number}?t=${data.order.access_token}&placed=1`
        );
        return;
      }

      if (data.code === "INSUFFICIENT_STOCK" && data.items) {
        setShortages(data.items);
        setErrorMsg(
          "Sorry, your order could not be placed because some items are no longer available in the requested quantity:"
        );
      } else if (data.code === "OFFER_CHANGED") {
        setErrorMsg(
          `${data.message} The page will refresh with the latest offer details.`
        );
        router.refresh();
      } else {
        setErrorMsg(data.message || "Something went wrong. Please try again.");
      }
      // failure may mean stock/offer data changed — get fresh values
      idemKeyRef.current = crypto.randomUUID();
    } catch {
      setErrorMsg(
        "Could not reach the server. Please check your connection and try again — your bucket is safe."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fixShortages() {
    for (const s of shortages) {
      cart.setQuantity(s.product_id, s.available);
    }
    setShortages([]);
    setErrorMsg(null);
    router.refresh();
  }

  if (!hydrated) {
    return <p className="py-16 text-center text-sm text-stone-500">Loading your bucket…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-16 text-center">
        <p className="text-4xl">🧺</p>
        <p className="mt-3 font-semibold">Your bucket is empty</p>
        <p className="mt-1 text-sm text-stone-500">
          Heavy discounts on limited stock — {settings.sale_days || "for a short time only"}.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
        >
          Browse the sale
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-32">
      <h1 className="text-xl font-bold">Your Bucket</h1>

      {/* items */}
      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl">
                  🛍️
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {formatINR(item.selling_price)} each
                {item.discount_pct > 0 && (
                  <span className="ml-1 text-stone-400 line-through">
                    {formatINR(item.mrp)}
                  </span>
                )}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex h-8 w-28 items-stretch overflow-hidden rounded-lg border border-stone-300">
                  <button
                    aria-label={`Decrease quantity of ${item.name}`}
                    onClick={() => cart.setQuantity(item.id, item.quantity - 1)}
                    className="flex-1 text-base font-bold text-stone-600 active:bg-stone-100"
                  >
                    −
                  </button>
                  <span className="flex flex-1 items-center justify-center text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    aria-label={`Increase quantity of ${item.name}`}
                    onClick={() => cart.setQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.available_qty}
                    className="flex-1 text-base font-bold text-stone-600 active:bg-stone-100 disabled:text-stone-300"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-bold">
                  {formatINR(Math.round(item.selling_price * item.quantity * 100) / 100)}
                </span>
              </div>
              {shortages.some((s) => s.product_id === item.id) && (
                <p className="mt-1 text-xs font-semibold text-danger">
                  Only {shortages.find((s) => s.product_id === item.id)?.available}{" "}
                  available now
                </p>
              )}
              <button
                onClick={() => cart.removeItem(item.id)}
                className="mt-1 text-xs text-stone-400 underline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}

        {/* free gift row */}
        {eligible && !belowMin && (
          <li className="flex items-center gap-3 bg-cta-soft p-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-2xl">
              🎁
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {eligible.free_product_name} × {eligible.free_qty}
              </p>
              <p className="text-xs text-stone-500">{eligible.name}</p>
            </div>
            <span className="rounded bg-deal px-2 py-0.5 text-xs font-extrabold uppercase text-white">
              Free
            </span>
          </li>
        )}
      </ul>

      {/* progress toward minimum order */}
      {minOrder > 0 && belowMin && (
        <div className="rounded-xl border border-navy/20 bg-navy-soft p-3">
          <p className="text-sm font-semibold">
            {formatINR(subtotal)} / {formatINR(minOrder)} — add{" "}
            {formatINR(remainingToMin)} more to place your order.
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-cta transition-all"
              style={{ width: `${Math.min(100, (subtotal / minOrder) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* progress toward next gift tier */}
      {!belowMin && nextTier && (
        <div className="rounded-xl border border-navy/20 bg-navy-soft p-3">
          <p className="text-sm">
            🎁 Add {formatINR(Math.round((nextTier.threshold - subtotal) * 100) / 100)}{" "}
            more to get a <strong>FREE {nextTier.free_product_name}</strong>!
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-cta transition-all"
              style={{ width: `${Math.min(100, (subtotal / nextTier.threshold) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* totals */}
      <div className="space-y-1 rounded-xl border border-stone-200 bg-white p-3 text-sm">
        <div className="flex justify-between">
          <span>Items ({cart.itemCount})</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        {eligible && !belowMin && (
          <div className="flex justify-between text-cta-dark">
            <span>Free gift: {eligible.free_product_name}</span>
            <span className="font-bold">₹0</span>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-extrabold">
          <span>Total payable at collection</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        <p className="text-xs text-stone-500">
          {settings.payment_instructions} No online payment.
        </p>
      </div>

      {/* customer details */}
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">Your details</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your full name"
            className="h-12 w-full rounded-lg border border-stone-300 px-3 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">WhatsApp / mobile number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="10-digit mobile number"
            className="h-12 w-full rounded-lg border border-stone-300 px-3 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
          />
          {phone && !phoneValid && (
            <span className="mt-1 block text-xs text-danger">
              Please enter a valid mobile number.
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Note <span className="font-normal text-stone-400">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Anything the shop should know"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
          />
        </label>
      </section>

      {/* collection location */}
      <section className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">Collection point</h2>
        <p className="text-xs text-stone-500">
          No home delivery — you collect your order and pay there.
        </p>
        {settings.sale_days && (
          <p className="text-xs font-bold text-navy">
            Sale &amp; collection {settings.sale_days} — please choose a weekend slot.
          </p>
        )}

        {confirmedLocations.map((loc) => (
          <label
            key={loc.id}
            className={`block cursor-pointer rounded-xl border p-3 ${
              locationChoice === loc.id
                ? "border-navy bg-navy-soft"
                : "border-stone-200"
            }`}
          >
            <span className="flex items-start gap-2.5">
              <input
                type="radio"
                name="location"
                checked={locationChoice === loc.id}
                onChange={() => setLocationChoice(loc.id)}
                className="mt-1 h-4 w-4 accent-navy"
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{loc.name}</span>
                {loc.area && (
                  <span className="block text-xs text-stone-500">{loc.area}</span>
                )}
                {loc.description && (
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {loc.description}
                  </span>
                )}
              </span>
            </span>
            {locationChoice === loc.id && loc.collection_slots.length > 0 && (
              <span className="mt-2 block space-y-1.5 border-t border-stone-200 pt-2">
                {loc.collection_slots.map((slot) => (
                  <label key={slot.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="slot"
                      checked={slotChoice === slot.id}
                      onChange={() => setSlotChoice(slot.id)}
                      className="h-4 w-4 accent-navy"
                    />
                    <span>
                      {formatSlotDate(slot.slot_date)} · {formatSlotTime(slot.start_time)}{" "}
                      – {formatSlotTime(slot.end_time)}
                      {slot.notes ? ` · ${slot.notes}` : ""}
                    </span>
                  </label>
                ))}
              </span>
            )}
          </label>
        ))}

        {comingSoonLocations.map((loc) => (
          <div
            key={loc.id}
            className="rounded-xl border border-dashed border-stone-200 p-3 opacity-70"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{loc.name}</p>
                {loc.area && <p className="text-xs text-stone-500">{loc.area}</p>}
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                Coming soon
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Schedule to be announced — we will notify soon.
            </p>
          </div>
        ))}

        <label
          className={`block cursor-pointer rounded-xl border p-3 ${
            locationChoice === "other" ? "border-navy bg-navy-soft" : "border-stone-200"
          }`}
        >
          <span className="flex items-start gap-2.5">
            <input
              type="radio"
              name="location"
              checked={locationChoice === "other"}
              onChange={() => setLocationChoice("other")}
              className="mt-1 h-4 w-4 accent-navy"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                Other — pick up from the shop
              </span>
              {locationChoice === "other" && (
                <span className="mt-1 block text-xs leading-relaxed text-stone-600">
                  <strong>Shop pickup (not home delivery):</strong>
                  <br />
                  {settings.shop_address}
                  <br />
                  {settings.shop_timings}
                </span>
              )}
            </span>
          </span>
        </label>
      </section>

      {/* terms */}
      <section className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">Before you place the order</h2>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-stone-600">
          <li>Closing / clearance sale at heavily discounted prices.</li>
          <li>No home delivery — collection only, at your selected point or the shop.</li>
          <li>Payment at collection. Cash preferred; UPI accepted at the shop.</li>
          <li>Inspect goods before accepting them.</li>
          <li>No returns or exchanges after purchase.</li>
          <li>Orders cannot be changed after placement — please verify your bucket now.</li>
        </ul>
        <label className="flex items-start gap-2.5 pt-1 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-navy"
          />
          <span>I have verified my bucket and I agree to the final-sale terms above.</span>
        </label>
      </section>

      {/* errors */}
      {errorMsg && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-3">
          <p className="text-sm font-semibold text-danger-dark">{errorMsg}</p>
          {shortages.length > 0 && (
            <>
              <ul className="mt-1 list-disc pl-5 text-sm text-stone-700">
                {shortages.map((s) => (
                  <li key={s.product_id}>
                    {s.name} — requested {s.requested}, available {s.available}
                  </li>
                ))}
              </ul>
              <button
                onClick={fixShortages}
                className="mt-2 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white"
              >
                Update my bucket automatically
              </button>
            </>
          )}
        </div>
      )}

      {/* sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-stone-500">Total at collection</p>
            <p className="text-lg font-extrabold leading-tight">{formatINR(subtotal)}</p>
          </div>
          <button
            onClick={placeOrder}
            disabled={!canSubmit}
            className="h-12 flex-1 rounded-xl bg-cta px-4 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 disabled:bg-stone-300"
          >
            {submitting ? "Placing your order…" : "Place Order on WhatsApp"}
          </button>
        </div>
        {belowMin && minOrder > 0 && (
          <p className="mx-auto mt-1 max-w-2xl text-center text-xs text-danger">
            Add {formatINR(remainingToMin)} more to reach the {formatINR(minOrder)}{" "}
            minimum order.
          </p>
        )}
      </div>
    </div>
  );
}
