-- =============================================================
-- Closing Sale — initial schema
-- Run order: 0001_schema.sql -> 0002_functions.sql -> 0003_rls.sql
-- =============================================================

create extension if not exists pg_trgm;

-- ---------- enums ----------
create type order_status as enum
  ('pending', 'confirmed', 'ready', 'collected', 'cancelled', 'expired');

create type location_status as enum
  ('confirmed', 'coming_soon', 'disabled');

create type inventory_source as enum
  ('manual', 'order', 'cancellation', 'expiration', 'promo_gift', 'bulk_import', 'collection', 'correction');

-- ---------- settings ----------
-- Key/value application settings. `public` rows are readable by anyone;
-- private rows (e.g. whatsapp_number) are only used server-side.
create table app_settings (
  key         text primary key,
  value       text not null,
  public      boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ---------- admin users ----------
create table admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'admin',
  created_at  timestamptz not null default now()
);

-- ---------- catalog ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text not null default '',
  category_id   uuid references categories (id),
  image_url     text,
  mrp           numeric(10,2) not null check (mrp > 0),
  selling_price numeric(10,2) not null check (selling_price > 0),
  discount_pct  numeric(5,2) generated always as
                  (round(((mrp - selling_price) / mrp) * 100, 2)) stored,
  active        boolean not null default true,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint selling_price_within_mrp check (selling_price <= mrp)
);

create index products_category_idx on products (category_id);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index products_description_trgm_idx on products using gin (description gin_trgm_ops);
create index products_active_idx on products (active, archived);

create table product_tags (
  product_id  uuid not null references products (id) on delete cascade,
  tag         text not null,
  primary key (product_id, tag)
);

create index product_tags_tag_trgm_idx on product_tags using gin (tag gin_trgm_ops);

-- ---------- inventory ----------
-- total_qty    = physical stock on hand
-- reserved_qty = stock committed to open (pending/confirmed/ready) orders
-- available    = what a new customer may still buy
create table inventory (
  product_id    uuid primary key references products (id) on delete cascade,
  total_qty     int not null default 0 check (total_qty >= 0),
  reserved_qty  int not null default 0 check (reserved_qty >= 0),
  available_qty int generated always as (total_qty - reserved_qty) stored,
  updated_at    timestamptz not null default now(),
  constraint reserved_within_total check (reserved_qty <= total_qty)
);

create table inventory_audit (
  id            bigint generated always as identity primary key,
  product_id    uuid not null references products (id) on delete cascade,
  prev_total    int not null,
  change        int not null,
  new_total     int not null,
  prev_reserved int not null,
  new_reserved  int not null,
  reason        text,
  source        inventory_source not null,
  admin_id      uuid references auth.users (id),
  order_id      uuid,
  created_at    timestamptz not null default now()
);

create index inventory_audit_product_idx on inventory_audit (product_id, created_at desc);

-- ---------- offers (tiered free gifts) ----------
create table offers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  threshold       numeric(10,2) not null check (threshold > 0),
  free_product_id uuid not null references products (id),
  free_qty        int not null default 1 check (free_qty > 0),
  priority        int not null default 0,
  active          boolean not null default true,
  archived        boolean not null default false,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index offers_threshold_idx on offers (threshold desc);

-- ---------- collection locations ----------
create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  area        text not null default '',
  description text not null default '',
  status      location_status not null default 'coming_soon',
  notes       text not null default '',
  archived    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table collection_slots (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  slot_date   date not null,
  start_time  time not null,
  end_time    time not null,
  active      boolean not null default true,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  constraint slot_times_valid check (end_time > start_time)
);

create index collection_slots_location_idx on collection_slots (location_id, slot_date);

-- ---------- orders ----------
-- Human-readable order numbers (CS-2026-000123) are allocated from
-- per-year counters inside the place_order transaction.
create table order_counters (
  year       int primary key,
  last_value int not null default 0
);

create table orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  access_token      uuid not null default gen_random_uuid(),
  idempotency_key   uuid not null unique,
  customer_name     text not null,
  customer_phone    text not null,
  location_id       uuid references locations (id),
  -- snapshots survive later edits to the location/slot catalog
  location_snapshot jsonb not null default '{}'::jsonb,
  slot_snapshot     jsonb,
  is_other_location boolean not null default false,
  customer_note     text not null default '',
  status            order_status not null default 'pending',
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  total             numeric(12,2) not null check (total >= 0),
  item_count        int not null check (item_count > 0),
  applied_offer_id  uuid references offers (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index orders_status_idx on orders (status, created_at desc);
create index orders_phone_idx on orders (customer_phone);
create index orders_location_idx on orders (location_id);

create table order_items (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references orders (id) on delete cascade,
  product_id    uuid not null references products (id),
  -- order-time snapshots: never re-read from the catalog
  product_name  text not null,
  image_url     text,
  mrp           numeric(10,2) not null,
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  discount_pct  numeric(5,2) not null default 0,
  quantity      int not null check (quantity > 0),
  line_total    numeric(12,2) not null check (line_total >= 0),
  is_free       boolean not null default false,
  offer_id      uuid references offers (id)
);

create index order_items_order_idx on order_items (order_id);
create index order_items_product_idx on order_items (product_id);

create table order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders (id) on delete cascade,
  old_status  order_status,
  new_status  order_status not null,
  changed_by  uuid references auth.users (id),  -- null = system/customer flow
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index order_status_history_order_idx on order_status_history (order_id, created_at);

-- link audit rows to orders now that orders exists
alter table inventory_audit
  add constraint inventory_audit_order_fk
  foreign key (order_id) references orders (id) on delete set null;

-- ---------- updated_at triggers ----------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on products
  for each row execute function touch_updated_at();
create trigger inventory_touch before update on inventory
  for each row execute function touch_updated_at();
create trigger orders_touch before update on orders
  for each row execute function touch_updated_at();
create trigger app_settings_touch before update on app_settings
  for each row execute function touch_updated_at();

-- ---------- default settings ----------
insert into app_settings (key, value, public) values
  ('shop_name',               'My Shop',                                          true),
  ('sale_title',              'CLOSING SALE',                                     true),
  ('sale_message',            'The shop is closing. Everything must go at genuine clearance prices. Limited stock — buy while it lasts!', true),
  ('min_order_value',         '500',                                              true),
  ('low_stock_threshold',     '10',                                               true),
  ('shop_address',            'Shop address not configured yet',                  true),
  ('shop_timings',            '10:00 AM – 8:00 PM, all days',                     true),
  ('payment_instructions',    'Pay at collection. Cash preferred; UPI accepted at the shop.', true),
  ('collection_instructions', 'Bring your Order ID when you come to collect.',    true),
  ('final_sale_terms',        'This is a final clearance sale. Inspect goods before accepting. No returns or exchanges after purchase. Orders cannot be modified after placement.', true),
  ('customer_notes',          '',                                                 true),
  ('whatsapp_number',         '',                                                 false);
