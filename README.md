# Closing Sale — Reservation & Collection Website

A mobile-first web application for a physical shop running a closing/clearance
sale. Customers browse products, build a **bucket**, reserve an order and get a
unique **Order ID** — then collect and pay at a pickup point. **No online
payment. No home delivery.** WhatsApp is used for communication; the database
is the source of truth.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Supabase** — PostgreSQL, Auth, Storage, Row Level Security
- Deploys to **Vercel**

## Project structure

```
supabase/
  migrations/0001_schema.sql      # tables, constraints, indexes, default settings
  migrations/0002_functions.sql   # place_order, update_order_status, search, lookup
  migrations/0003_rls.sql         # row-level security policies
  storage.sql                     # product-images bucket + policies
  seed.sql                        # demo data (remove before production)
src/
  app/(customer)/                 # catalog, product, bucket, order pages
  app/admin/                      # admin login + guarded dashboard
  app/api/                        # order placement, lookup, catalog search
  components/                     # customer UI, cart state, admin bits
  lib/                            # supabase clients, data access, formatting
```

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run these files **in order**:
   1. `supabase/migrations/0001_schema.sql`
   2. `supabase/migrations/0002_functions.sql`
   3. `supabase/migrations/0003_rls.sql`
   4. `supabase/storage.sql`
   5. `supabase/seed.sql` *(development demo data — optional)*

### 2. Create the first admin user

1. Supabase Dashboard → **Authentication → Users → Add user** (email + password,
   check "Auto confirm").
2. Copy the user's UUID, then in the SQL editor:

```sql
insert into admin_users (user_id) values ('PASTE-USER-UUID-HERE');
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the Supabase URL, anon key and service-role key from
**Settings → API**. Secrets are never committed and never sent to the browser.

### 4. Configure the business settings

All business configuration lives in the `app_settings` table (shop name,
WhatsApp number, minimum order value, low-stock threshold, address, timings,
policies). The seed sets sensible demo values; edit them in the Table Editor
(or via the admin dashboard once the admin phase is built), e.g.:

```sql
update app_settings set value = '91XXXXXXXXXX' where key = 'whatsapp_number';
update app_settings set value = '500'          where key = 'min_order_value';
```

### 5. Run

```bash
npm install
npm run dev
```

- Customer site: http://localhost:3000
- Admin: http://localhost:3000/admin

## How ordering works (important invariants)

1. The customer's bucket lives in the browser (convenience only).
2. **Place Order** calls `POST /api/orders`, which invokes the `place_order`
   database function — one transaction that: re-prices every item from the DB,
   enforces the minimum order value, picks the highest qualifying free-gift
   tier *with stock*, locks inventory rows, verifies every quantity, reserves
   stock, allocates a unique `CS-YYYY-NNNNNN` order number and persists the
   order with price snapshots. Any failure rolls back everything.
3. Only after the order is persisted does the app open WhatsApp with the
   generated order message. If WhatsApp fails, the order still exists and the
   confirmation page offers the link + a copyable message.
4. Duplicate submissions are absorbed by an idempotency key — one order, one ID.
5. Inventory: `total_qty` (physical) vs `reserved_qty` (open orders) vs
   `available_qty` (generated). Overselling is impossible at the database level
   (`reserved_qty <= total_qty` constraint + row locks).

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Import into Vercel; set the three environment variables from `.env.example`.
3. Deploy. Run the SQL files against your production Supabase project
   (without `seed.sql`, or after removing the `[DEMO]` rows).
