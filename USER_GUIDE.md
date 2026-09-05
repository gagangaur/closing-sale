# Radha Krishna Book Depo — Closing Sale: Feature Guide

Everything the app does and how to use it. Two areas: the **customer website**
(what shoppers see) and the **admin dashboard** at `/admin` (what the
shopkeeper uses).

---

## Customer website

### Hero, share card & weekend strip
- **Hero** (navy; every line editable in admin Settings), top to bottom: shop
  name → **CLOSING SALE** → gold **Heavy Discount SALE** sub-headline → legacy
  badge ("Serving Mathura for 28 years") → farewell message → "Thank you,
  Mathura, for 28 wonderful years." → a gold **Limited Stock / ONLY ON
  SATURDAY & SUNDAY** strip → reservation pills (reserve online, minimum order,
  heavy discounts) → free-gift tiers.
- **Share this sale** card (white, at the bottom of the hero, made to be
  screenshotted or forwarded): shop name, headline, sub-headline, sale days,
  address, timings, how to reserve, and the policy line kept verbatim —
  *Final sale — no returns/exchanges · No home delivery · Cash preferred, UPI
  accepted at the shop · No online payment.* **Share on WhatsApp** opens
  WhatsApp's contact picker with a short forwardable message (no recipient
  pre-filled); **Copy message** copies the same text.
- **Weekend strip**: a slim gold "ONLY ON SATURDAY & SUNDAY · Limited stock ·
  Reserve online, collect & pay at pickup" bar sits under the header on
  **every** customer page, not only the home page.
- **Look & feel**: navy is the primary colour, green is used for all positive
  actions (add to bucket, place order, WhatsApp), gold for small accents
  (weekend strip, legacy badge); red appears only for errors, out-of-stock and
  destructive admin actions. No discount percentages appear in marketing copy.

### Browsing & search
- Below the hero comes the catalog.
- **Search bar** matches product names, descriptions, category names and tags
  as you type. **Category chips** filter; the **sort menu** offers Newest,
  Popular (by real order data), Price low→high, Price high→low.
- **Discovery sections** (shown when not searching):
  - 🔥 **Almost Gone** — items at or below the low-stock threshold ("Only 2 left").
  - ⭐ **Popular Picks** — best sellers computed from actual orders.
- Products load 24 at a time with a **Load more** button — the browser never
  downloads the whole catalog.
- Every product card shows **MRP struck through, a green % OFF badge (the real
  discount from MRP — factual data, not marketing copy), sale price** and a
  stock badge. Tapping a card opens the **product page** with description,
  tags and a larger add-to-bucket control.

### Bucket (cart)
- **Add to bucket** turns into a − / + stepper. You can never add more than
  the available stock, and out-of-stock items can't be added at all.
- The bucket page (🧺 button, top right) shows each item with quantity
  controls, remove, line totals, and the running total.
- **Minimum order progress**: below the minimum you see
  "₹350 / ₹500 — add ₹150 more" with a progress bar; the order button stays
  disabled until the minimum is reached.
- **Free gift tiers**: when the bucket crosses a tier (e.g. ₹1,000), the gift
  appears in the bucket marked **FREE** at ₹0. A progress bar nudges toward
  the next tier. Multiple tiers → the highest qualifying one applies.
- The bucket survives page reloads (saved in the browser) but is only a
  convenience — everything is re-checked on the server at order time.

### Placing an order
1. Fill in **name** and **WhatsApp/mobile number** (nothing else is collected —
   no addresses, no GPS).
2. Pick a **collection point**: a confirmed location (with its date/time
   slots), or **Other** = pickup from the shop (address and timings shown).
   "Coming soon" locations are visible but not selectable — no fake dates.
3. Review the **final-sale terms** and tick the checkbox (no returns, no
   delivery, pay at collection, order can't be changed).
4. Tap **Place Order on WhatsApp**. The server then atomically: re-prices
   every item from the database, checks the minimum, validates the gift,
   locks and reserves stock, and creates the order with a unique ID like
   `CS-2026-000001`. If anything is short, the whole order fails with an
   exact list ("Product A — requested 5, available 2") and a one-tap
   **"Update my bucket automatically"** fix.
5. WhatsApp opens pre-filled with the complete order message to the shop's
   number. The order exists in the database **before** WhatsApp opens — if
   WhatsApp fails, the confirmation page has a **Send on WhatsApp** button
   and a copyable message.
6. Double-clicking can't create duplicates (idempotency key) — one order,
   one ID.

### After ordering
- The confirmation page (secure token link) shows the order, its status, and
  collection details. Orders **cannot be edited** — customers contact the
  shop on WhatsApp for mistakes.
- **My Order** (header link, `/find-order`): look up any order with the
  Order ID + the phone number used on it. Nobody can see anyone else's order.

---

## Admin dashboard (`/admin`)

Sign in at `/admin/login`. Only users listed in the `admin_users` table get in
— both the pages and the database itself (RLS) enforce this.

### Dashboard
- Stat cards: active products, stock units (total / reserved / available),
  total orders + units sold + gifts given, order value (total and collected).
- **Orders by status** — click any status to jump to that filtered list.
- **Top 10 low inventory** (out-of-stock highlighted red) and **Top 10 most
  ordered** with revenue — cancelled/expired orders excluded.

### Products
- **List** with search and All / Active / Inactive / Archived filters.
- **+ Add product**: name, description, category (pick one or type a new one —
  it's created automatically), tags, then pricing: enter **MRP + selling
  price** or **MRP + discount %** — the other is calculated live. Set initial
  stock (recorded in the audit log) and Active.
- **Edit page** adds: image upload (JPG/PNG/WebP ≤ 5 MB), a stock summary,
  and **Archive** — archived products vanish from the shop but stay intact in
  past orders and reports. Restore any time. The Active checkbox
  hides/shows a product without archiving.

### CSV import (`Products → Import CSV`)
1. **Download template** — columns: name, description, category, tags
   (separated by `|` or `,`), mrp, selling_price, quantity, active.
2. Upload your file → instant **server-side validation** with row-by-row
   errors (bad prices, price > MRP, duplicate names, bad quantities…).
3. **Confirm** — import is all-or-nothing; if any row fails, nothing is
   created. New categories are created automatically; quantities are audited.
   Images can't come from CSV — add them on each product's edit page.

### Inventory
- Table of **Total / Reserved / Available** per product. Reserved = stock
  committed to open orders; Available = what customers can still buy.
- Filters: search, category, **Low stock**, **Out of stock**. Badges mark
  low / very low / out.
- **Adjust**: set / increase / decrease with a reason. The system refuses to
  drop total stock below what's reserved for open orders.
- **Audit log**: every stock movement ever — manual changes, order
  reservations, free gifts, cancellations, collections, imports — with
  before/after values, reason, source and timestamp.

### Orders
- **List**: filter by status, date range, or search Order ID / customer /
  phone. Shows collection point, item count, total, status.
- **Detail**: items at their **order-time prices** (later catalog changes
  never touch old orders), customer with a one-tap WhatsApp link, collection
  info, full status history.
- **Status workflow** (each change is recorded, with optional note):
  - Pending → **Confirm** → **Mark ready** → **Mark collected & paid**
  - **Cancel** or **Expire** at any point before collection → reserved stock
    is released back for sale automatically.
  - **Collected** deducts physical stock permanently.
  - Collected / Cancelled / Expired are final — no further changes.
- Order contents can't be edited — for corrections, cancel (stock returns)
  and have the customer re-order.

### Offers
- Create tiers: name, cart threshold (₹), free product, free quantity,
  priority, active. The editor refuses a gift that's inactive or out of
  stock, and shows remaining gift stock per offer.
- Customers automatically get the **highest tier** their cart qualifies for.
  Gift stock is real inventory — reserved with the order.

### Locations
- Create collection points with name, society/area, instructions and status:
  - **Confirmed** — customers can select it (add date/time slots!).
  - **Coming soon** — customers see it with "schedule to be announced".
  - **Disabled / Archived** — hidden.
- Add multiple **date + time slots** per location; delete outdated ones.

### Reports
- **Export orders to CSV** — one row per order item with every detail;
  filter by status/dates/search first. Opens correctly in Excel (UTF-8, ₹).

### Settings
Everything configurable, live, no code changes:
shop name · sale headline (**CLOSING SALE**) · sale sub-headline (**Heavy
Discount SALE**) · legacy badge · sale message · thank-you message · sale days
(**ONLY ON SATURDAY & SUNDAY** — shown in the hero, the share card and the strip
on every page) · **WhatsApp number** (where orders arrive) · **minimum order
value** · **low-stock threshold** · shop address & timings · payment /
collection instructions · final-sale terms · extra customer notes.

The four hero fields (`sale_subtitle`, `legacy_badge`, `thank_you_message`,
`sale_days`) are added by `supabase/migrations/0005_branding.sql` — run it once
on a project created before the branding update.

---

## Guarantees built into the database

- **No overselling** — order placement locks inventory rows and reserves
  stock in one transaction; concurrent orders can't both take the last unit.
- **All-or-nothing orders** — if any item (or the gift) is short, nothing is
  reserved and no order is created.
- **Price history is immutable** — orders snapshot name/MRP/price/discount at
  purchase time.
- **The database is the source of truth** — WhatsApp is only a message; the
  order exists first.
- **Security** — customers can only read the public catalog. Orders are
  reachable only via secure token or ID+phone. All admin writes require an
  admin account, enforced by row-level security in the database, not just
  hidden buttons.
