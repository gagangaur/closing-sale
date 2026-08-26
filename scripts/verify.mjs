/**
 * Closing Sale — live verification suite (Prompt 3).
 *
 * Runs against the real Supabase project using .env.local. Creates its own
 * ZZTEST products/offer, exercises the ordering engine (concurrency,
 * rollback, idempotency, gift tiers, snapshots, status transitions) and the
 * security boundary (anon key probes), then cleans everything up.
 *
 * Usage:  node scripts/verify.mjs
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// ---------- tiny test harness ----------
let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function section(title) {
  console.log(`\n■ ${title}`);
}

// ---------- helpers ----------
async function inv(productId) {
  const { data } = await service
    .from("inventory")
    .select("total_qty, reserved_qty, available_qty")
    .eq("product_id", productId)
    .single();
  return data;
}

function orderInput({ items, name = "ZZTEST Customer", phone = "9998887771", expected = null, key }) {
  return {
    customer: { name, phone },
    items,
    location_id: null,
    slot_id: null,
    is_other_location: true,
    note: "automated verification order",
    expected_offer_id: expected,
    idempotency_key: key ?? randomUUID(),
  };
}

async function place(input) {
  const { data, error } = await service.rpc("place_order", { p_input: input });
  if (error) return { ok: false, code: "RPC_ERROR", message: error.message };
  return data;
}

// ---------- main ----------
const created = { products: [], offerId: null };

async function setup() {
  section("Setup: create ZZTEST products");
  const rows = [
    { key: "A", name: "ZZTEST Product A", mrp: 300, selling_price: 150, qty: 5 },
    { key: "B", name: "ZZTEST Product B", mrp: 500, selling_price: 250, qty: 40 },
    { key: "G", name: "ZZTEST Gift", mrp: 200, selling_price: 100, qty: 1 },
  ];
  const ids = {};
  for (const r of rows) {
    const { data, error } = await service
      .from("products")
      .insert({ name: r.name, description: "test", mrp: r.mrp, selling_price: r.selling_price })
      .select("id")
      .single();
    if (error) throw new Error(`setup product failed: ${error.message}`);
    ids[r.key] = data.id;
    created.products.push(data.id);
    const { error: invErr } = await service
      .from("inventory")
      .insert({ product_id: data.id, total_qty: r.qty });
    if (invErr) throw new Error(`setup inventory failed: ${invErr.message}`);
  }
  console.log("  created A (5 in stock, ₹150), B (40 in stock, ₹250), Gift (1 in stock)");
  return ids;
}

async function run() {
  const ids = await setup();
  const P = ids.A, B = ids.B, G = ids.G;

  // -------------------------------------------------- input validation
  section("1 · Input validation (server-side)");
  let r = await place(orderInput({ items: [{ product_id: P, quantity: -2 }] }));
  check("negative quantity rejected", !r.ok && r.code === "INVALID_INPUT", JSON.stringify(r));
  r = await place(orderInput({ items: [{ product_id: P, quantity: 0 }] }));
  check("zero quantity rejected", !r.ok);
  r = await place(orderInput({ items: [] }));
  check("empty bucket rejected", !r.ok);
  r = await place(orderInput({ items: [{ product_id: randomUUID(), quantity: 1 }] }));
  check("unknown product rejected", !r.ok && r.code === "PRODUCT_UNAVAILABLE", JSON.stringify(r));
  r = await place({ ...orderInput({ items: [{ product_id: B, quantity: 2 }] }), customer: { name: "Z", phone: "12" } });
  check("bad name/phone rejected", !r.ok && r.code === "INVALID_INPUT");

  // -------------------------------------------------- minimum order
  section("2 · Minimum order value (₹500)");
  r = await place(orderInput({ items: [{ product_id: B, quantity: 1 }] })); // 250
  check("₹250 cart blocked (MIN_ORDER_NOT_MET)", !r.ok && r.code === "MIN_ORDER_NOT_MET", JSON.stringify(r));
  check("error reports amounts", !r.ok && Number(r.min_order_value) === 500 && Number(r.subtotal) === 250);

  // -------------------------------------------------- insufficient stock
  section("3 · Insufficient stock");
  r = await place(orderInput({ items: [{ product_id: P, quantity: 6 }] })); // avail 5, 6*150=900
  check("overselling rejected (INSUFFICIENT_STOCK)", !r.ok && r.code === "INSUFFICIENT_STOCK", JSON.stringify(r));
  check(
    "shortage lists requested vs available",
    !r.ok && r.items?.[0]?.requested === 6 && r.items?.[0]?.available === 5
  );

  // -------------------------------------------------- partial failure rollback
  section("4 · Partial failure = complete rollback");
  const bBefore = await inv(B);
  r = await place(orderInput({ items: [{ product_id: B, quantity: 2 }, { product_id: P, quantity: 6 }] }));
  check("mixed cart with one short item fails entirely", !r.ok && r.code === "INSUFFICIENT_STOCK");
  const bAfter = await inv(B);
  check(
    "no partial reservation of the in-stock item",
    bAfter.reserved_qty === bBefore.reserved_qty,
    `reserved ${bBefore.reserved_qty} -> ${bAfter.reserved_qty}`
  );

  // -------------------------------------------------- concurrency
  section("5 · Concurrent orders cannot oversell (A: stock 5; 4 vs 3 simultaneously)");
  const [c1, c2] = await Promise.all([
    place(orderInput({ items: [{ product_id: P, quantity: 4 }], phone: "9998887772" })), // 600
    place(orderInput({ items: [{ product_id: P, quantity: 3 }, { product_id: B, quantity: 1 }], phone: "9998887773" })), // 700
  ]);
  const successes = [c1, c2].filter((x) => x.ok);
  const fails = [c1, c2].filter((x) => !x.ok);
  check("exactly one order succeeded", successes.length === 1 && fails.length === 1,
    `results: ${c1.ok ? "ok" : c1.code} / ${c2.ok ? "ok" : c2.code}`);
  check("loser got INSUFFICIENT_STOCK", fails[0]?.code === "INSUFFICIENT_STOCK", JSON.stringify(fails[0]));
  const pInv = await inv(P);
  check("stock never negative / overcommitted",
    pInv.available_qty >= 0 && pInv.reserved_qty <= pInv.total_qty,
    JSON.stringify(pInv));
  const winner = successes[0];
  const winnerQty = winner === c1 ? 4 : 3;
  check(`winner reserved exactly its quantity (${winnerQty})`, pInv.reserved_qty === winnerQty, JSON.stringify(pInv));

  // -------------------------------------------------- idempotency
  section("6 · Duplicate submission protection");
  const dupKey = randomUUID();
  const first = await place(orderInput({ items: [{ product_id: B, quantity: 2 }], key: dupKey }));
  const second = await place(orderInput({ items: [{ product_id: B, quantity: 2 }], key: dupKey }));
  check("first submission creates order", first.ok === true, JSON.stringify(first));
  check("second submission returns the SAME order (duplicate flag)",
    second.ok === true && second.duplicate === true &&
    second.order.order_number === first.order.order_number,
    JSON.stringify(second));
  const bInv6 = await inv(B);
  check("stock reserved only once", bInv6.reserved_qty === bBefore.reserved_qty + 2 + (winnerQty === 3 ? 1 : 0),
    JSON.stringify(bInv6));

  // -------------------------------------------------- gift tiers
  section("7 · Free-gift tiers (ZZTEST offer: ₹1,200 → 1 × Gift, stock 1)");
  const { data: offerRow, error: offerErr } = await service
    .from("offers")
    .insert({ name: "ZZTEST offer", threshold: 1200, free_product_id: G, free_qty: 1, priority: 99 })
    .select("id")
    .single();
  if (offerErr) throw new Error(offerErr.message);
  created.offerId = offerRow.id;

  // 5 × B = 1250 ≥ 1200 → ZZTEST tier (higher than seed ₹1,000 tier)
  const gift1 = await place(orderInput({ items: [{ product_id: B, quantity: 5 }], expected: offerRow.id, phone: "9998887774" }));
  check("qualifying order gets the highest tier's gift", gift1.ok && gift1.order.applied_offer?.name === "ZZTEST offer", JSON.stringify(gift1.order?.applied_offer ?? gift1));
  check("gift line is free (₹0) and does not raise the total",
    gift1.ok && Number(gift1.order.total) === 1250 &&
    gift1.order.items.some((i) => i.is_free && Number(i.line_total) === 0));
  const gInv = await inv(G);
  check("gift inventory reserved", gInv.reserved_qty === 1 && gInv.available_qty === 0, JSON.stringify(gInv));

  // gift now exhausted → server must NOT honor the same expectation
  const gift2 = await place(orderInput({ items: [{ product_id: B, quantity: 5 }], expected: offerRow.id, phone: "9998887775" }));
  check("exhausted gift → OFFER_CHANGED (never promises unavailable stock)",
    !gift2.ok && gift2.code === "OFFER_CHANGED", JSON.stringify(gift2));
  const fallbackOfferId = gift2.applied_offer?.id ?? null;
  check("recalculated offer returned for retry", !gift2.ok && "applied_offer" in gift2);

  // retry with the recalculated expectation → succeeds with fallback tier
  const gift3 = await place(orderInput({ items: [{ product_id: B, quantity: 5 }], expected: fallbackOfferId, phone: "9998887775" }));
  check("retry with recalculated offer succeeds", gift3.ok === true, JSON.stringify(gift3));

  // -------------------------------------------------- price snapshots
  section("8 · Order history is immutable (price snapshots)");
  await service.from("products").update({ selling_price: 260 }).eq("id", B);
  const { data: snapItems } = await service
    .from("order_items")
    .select("unit_price")
    .eq("order_id", first.order.id ?? "")
    .eq("product_id", B);
  // fall back to lookup via order number when id not present in response
  let snapPrice = snapItems?.[0]?.unit_price;
  if (snapPrice === undefined) {
    const { data: ord } = await service
      .from("orders").select("id").eq("order_number", first.order.order_number).single();
    const { data: items2 } = await service
      .from("order_items").select("unit_price").eq("order_id", ord.id).eq("product_id", B);
    snapPrice = items2?.[0]?.unit_price;
  }
  check("catalog price change does NOT alter existing order", Number(snapPrice) === 250,
    `snapshot price = ${snapPrice}`);
  await service.from("products").update({ selling_price: 250 }).eq("id", B);

  // -------------------------------------------------- status transitions
  section("9 · Status transitions drive inventory");
  const { data: firstOrd } = await service
    .from("orders").select("id").eq("order_number", first.order.order_number).single();
  const bBeforeCancel = await inv(B);
  let st = await service.rpc("update_order_status", { p_order_id: firstOrd.id, p_new_status: "cancelled", p_note: "test" });
  check("cancel succeeds", st.data?.ok === true, JSON.stringify(st.data ?? st.error));
  const bAfterCancel = await inv(B);
  check("cancel releases reserved stock (+2 available)",
    bAfterCancel.reserved_qty === bBeforeCancel.reserved_qty - 2, JSON.stringify(bAfterCancel));
  st = await service.rpc("update_order_status", { p_order_id: firstOrd.id, p_new_status: "confirmed", p_note: "" });
  check("cancelled is FINAL — cannot change again", st.data?.ok === false && st.data?.code === "FINAL_STATUS", JSON.stringify(st.data));

  const { data: winOrd } = await service
    .from("orders").select("id").eq("order_number", winner.order.order_number).single();
  const pBeforeCollect = await inv(P);
  st = await service.rpc("update_order_status", { p_order_id: winOrd.id, p_new_status: "collected", p_note: "test collection" });
  check("collect succeeds", st.data?.ok === true, JSON.stringify(st.data ?? st.error));
  const pAfterCollect = await inv(P);
  check("collection deducts physical stock and releases reservation",
    pAfterCollect.total_qty === pBeforeCollect.total_qty - winnerQty &&
    pAfterCollect.reserved_qty === pBeforeCollect.reserved_qty - winnerQty,
    JSON.stringify(pAfterCollect));

  // -------------------------------------------------- inventory floor
  section("10 · Admin cannot cut stock below open-order reservations");
  const bNow = await inv(B);
  if (bNow.reserved_qty > 0) {
    const adj = await service.rpc("adjust_inventory", {
      p_product_id: B, p_mode: "set", p_qty: bNow.reserved_qty - 1, p_reason: "test",
    });
    check("BELOW_RESERVED rejected with clear message",
      adj.data?.ok === false && adj.data?.code === "BELOW_RESERVED", JSON.stringify(adj.data));
  } else {
    check("BELOW_RESERVED rejected with clear message", false, "no reserved stock to test against");
  }
  const adjOk = await service.rpc("adjust_inventory", { p_product_id: B, p_mode: "increase", p_qty: 5, p_reason: "test increase" });
  check("audited increase works", adjOk.data?.ok === true, JSON.stringify(adjOk.data ?? adjOk.error));
  const { data: auditRows } = await service
    .from("inventory_audit").select("source, change").eq("product_id", B).order("id", { ascending: false }).limit(1);
  check("audit record written", auditRows?.[0]?.change === 5 && auditRows?.[0]?.source === "manual");

  // -------------------------------------------------- security (anon key)
  section("11 · Security — what an anonymous visitor can and cannot do");
  let q = await anon.from("orders").select("*");
  check("anon cannot read ANY orders", (q.data ?? []).length === 0);
  q = await anon.from("inventory_audit").select("*");
  check("anon cannot read the audit log", (q.data ?? []).length === 0);
  q = await anon.from("app_settings").select("key").eq("key", "whatsapp_number");
  check("anon cannot read private settings (whatsapp number)", (q.data ?? []).length === 0);
  q = await anon.from("products").update({ selling_price: 1 }).eq("id", B).select();
  check("anon cannot change prices", (q.data ?? []).length === 0 || q.error != null);
  const { data: bPrice } = await service.from("products").select("selling_price").eq("id", B).single();
  check("price unchanged after attack", Number(bPrice.selling_price) === 250, `price=${bPrice.selling_price}`);
  q = await anon.from("products").insert({ name: "hack", mrp: 1, selling_price: 1 }).select();
  check("anon cannot create products", q.error != null || (q.data ?? []).length === 0);
  let rpc = await anon.rpc("place_order", { p_input: orderInput({ items: [{ product_id: B, quantity: 2 }] }) });
  check("anon cannot call place_order directly (server-only)", rpc.error != null, JSON.stringify(rpc.data ?? {}));
  rpc = await anon.rpc("adjust_inventory", { p_product_id: B, p_mode: "set", p_qty: 0, p_reason: "hack" });
  check("anon cannot adjust inventory", rpc.error != null || rpc.data?.ok === false);
  rpc = await anon.rpc("update_order_status", { p_order_id: winOrd.id, p_new_status: "cancelled", p_note: "hack" });
  check("anon cannot change order status", rpc.error != null || rpc.data?.ok === false);
  rpc = await anon.rpc("lookup_order", { p_order_number: winner.order.order_number, p_token: null, p_phone: "0000000000" });
  check("order lookup fails with wrong phone", rpc.data?.ok === false && rpc.data?.code === "VERIFY_FAILED");
  rpc = await anon.rpc("lookup_order", { p_order_number: winner.order.order_number, p_token: null, p_phone: winnerQty === 4 ? "9998887772" : "9998887773" });
  check("order lookup succeeds with correct phone", rpc.data?.ok === true);
  rpc = await anon.rpc("search_products", { p_query: null, p_category_slug: null, p_sort: "newest", p_filter: null, p_page: 1, p_page_size: 1 });
  check("public catalog search works for anon", rpc.data?.items != null);

  // -------------------------------------------------- database constraints
  section("12 · Database constraints (last line of defense)");
  q = await service.from("products").insert({ name: "ZZTEST bad", mrp: 100, selling_price: 200 }).select();
  check("selling_price > MRP rejected by constraint", q.error != null, q.error?.message ?? "");
  q = await service.from("inventory").update({ total_qty: -5 }).eq("product_id", B).select();
  check("negative stock rejected by constraint", q.error != null, q.error?.message ?? "");

  // -------------------------------------------------- cleanup
  section("Cleanup");
  const { data: testOrders } = await service
    .from("orders").select("id, status").ilike("customer_name", "ZZTEST%");
  for (const o of testOrders ?? []) {
    if (!["collected", "cancelled", "expired"].includes(o.status)) {
      await service.rpc("update_order_status", { p_order_id: o.id, p_new_status: "cancelled", p_note: "test cleanup" });
    }
  }
  const { error: delOrdersErr } = await service.from("orders").delete().ilike("customer_name", "ZZTEST%");
  if (created.offerId) await service.from("offers").delete().eq("id", created.offerId);
  const { error: delProdErr } = await service.from("products").delete().ilike("name", "ZZTEST%");
  console.log(`  removed test orders (${delOrdersErr?.message ?? "ok"}), offer, products (${delProdErr?.message ?? "ok"})`);

  // seed gift stock should be back to normal (net zero reservations)
  const { data: lunchbox } = await service
    .from("products").select("name, inventory (reserved_qty)").ilike("name", "%Lunch Box%").limit(1).single();
  const lbReserved = lunchbox?.inventory?.reserved_qty ?? lunchbox?.inventory?.[0]?.reserved_qty ?? 0;
  check("seed gift reservations fully released after cleanup", lbReserved === 0, `reserved=${lbReserved}`);

  // -------------------------------------------------- summary
  console.log(`\n════════════════════════════════════`);
  console.log(`  ${passed} passed · ${failed} failed`);
  if (failures.length) {
    console.log("  Failed checks:");
    for (const f of failures) console.log(`   - ${f}`);
  }
  console.log(`════════════════════════════════════`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(2);
});
