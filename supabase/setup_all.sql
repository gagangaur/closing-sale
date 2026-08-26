-- ============================================================================
-- CLOSING SALE — ONE-SHOT DATABASE SETUP
-- Paste this entire file into the Supabase SQL Editor and click Run.
-- Includes: schema + functions + RLS + admin functions + demo seed data.
-- ============================================================================

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


-- ============================ FUNCTIONS ============================
-- =============================================================
-- Closing Sale — business logic functions
-- =============================================================

-- ---------- helpers ----------

create or replace function is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

create or replace function is_service_role()
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- Central place for admin-or-service authorization inside RPCs.
create or replace function assert_admin()
returns void
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (is_service_role() or is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end $$;

-- ---------- place_order ----------
-- The single write path for customer orders. Everything is validated and
-- reserved inside one transaction; any failure rolls the whole order back.
--
-- input: {
--   customer: { name, phone },
--   items: [{ product_id, quantity }],
--   location_id: uuid | null,      -- null when is_other_location
--   slot_id: uuid | null,
--   is_other_location: bool,
--   note: text,
--   expected_offer_id: uuid | null, -- what the customer was shown
--   idempotency_key: uuid
-- }
create or replace function place_order(p_input jsonb)
returns jsonb
language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  v_key             uuid;
  v_existing        orders%rowtype;
  v_name            text;
  v_phone           text;
  v_note            text;
  v_is_other        boolean;
  v_location_id     uuid;
  v_slot_id         uuid;
  v_expected_offer  uuid;
  v_location        locations%rowtype;
  v_slot            collection_slots%rowtype;
  v_location_snap   jsonb := '{}'::jsonb;
  v_slot_snap       jsonb;
  v_items           jsonb;
  v_item            record;
  v_subtotal        numeric(12,2) := 0;
  v_item_count      int := 0;
  v_min_order       numeric(12,2);
  v_offer           record;
  v_ap_offer_id     uuid;
  v_ap_offer_name   text;
  v_ap_threshold    numeric(10,2);
  v_ap_product_id   uuid;
  v_ap_product_name text;
  v_ap_product_img  text;
  v_ap_product_mrp  numeric(10,2);
  v_ap_free_qty     int;
  v_shortages       jsonb := '[]'::jsonb;
  v_order_id        uuid;
  v_order_number    text;
  v_counter         int;
  v_year            int;
  v_token           uuid;
  v_items_out       jsonb := '[]'::jsonb;
begin
  -- ---- parse & basic validation -------------------------------------
  v_key := nullif(p_input ->> 'idempotency_key', '')::uuid;
  if v_key is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Missing idempotency key.');
  end if;

  -- idempotency: double-submit returns the already-created order
  select * into v_existing from orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true,
      'order', jsonb_build_object(
        'id', v_existing.id,
        'order_number', v_existing.order_number,
        'access_token', v_existing.access_token,
        'total', v_existing.total));
  end if;

  v_name  := trim(coalesce(p_input -> 'customer' ->> 'name', ''));
  v_phone := regexp_replace(coalesce(p_input -> 'customer' ->> 'phone', ''), '[^0-9]', '', 'g');
  v_note  := left(trim(coalesce(p_input ->> 'note', '')), 500);
  v_is_other := coalesce((p_input ->> 'is_other_location')::boolean, false);
  v_location_id := nullif(p_input ->> 'location_id', '')::uuid;
  v_slot_id := nullif(p_input ->> 'slot_id', '')::uuid;
  v_expected_offer := nullif(p_input ->> 'expected_offer_id', '')::uuid;
  v_items := p_input -> 'items';

  if length(v_name) < 2 or length(v_name) > 100 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Please enter your name.');
  end if;
  if length(v_phone) < 10 or length(v_phone) > 15 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Please enter a valid WhatsApp/mobile number.');
  end if;
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Your bucket is empty.');
  end if;

  -- ---- location validation + snapshot --------------------------------
  if v_is_other then
    v_location_snap := jsonb_build_object(
      'type', 'other',
      'name', 'Shop pickup',
      'shop_address', (select value from app_settings where key = 'shop_address'),
      'shop_timings', (select value from app_settings where key = 'shop_timings'));
  else
    select * into v_location from locations
      where id = v_location_id and not archived and status = 'confirmed';
    if not found then
      return jsonb_build_object('ok', false, 'code', 'LOCATION_INVALID',
        'message', 'The selected collection location is not available. Please choose another.');
    end if;
    v_location_snap := jsonb_build_object(
      'type', 'location',
      'name', v_location.name,
      'area', v_location.area,
      'description', v_location.description,
      'notes', v_location.notes);
    if v_slot_id is not null then
      select * into v_slot from collection_slots
        where id = v_slot_id and location_id = v_location.id and active;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'LOCATION_INVALID',
          'message', 'The selected collection time is not available. Please choose another.');
      end if;
      v_slot_snap := jsonb_build_object(
        'slot_date', v_slot.slot_date,
        'start_time', v_slot.start_time,
        'end_time', v_slot.end_time,
        'notes', v_slot.notes);
    end if;
  end if;

  -- ---- normalize cart: aggregate duplicates, validate quantities -----
  create temp table _cart (product_id uuid primary key, quantity int) on commit drop;
  begin
    insert into _cart
    select (e ->> 'product_id')::uuid, sum((e ->> 'quantity')::int)
    from jsonb_array_elements(v_items) e
    group by 1;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Your bucket contains invalid items.');
  end;

  if exists (select 1 from _cart where quantity is null or quantity < 1 or quantity > 999) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Item quantities must be between 1 and 999.');
  end if;

  -- ---- lock inventory rows in one ordered statement -------------------
  -- Locks cart products plus every active offer's free product so that the
  -- lock order is always by product_id — no deadlocks between orders.
  perform 1
  from inventory i
  where i.product_id in (
          select product_id from _cart
          union
          select free_product_id from offers
          where active and not archived
            and (starts_at is null or starts_at <= now())
            and (ends_at is null or ends_at >= now()))
  order by i.product_id
  for update of i;

  -- ---- price from the database (never trust the client) ---------------
  create temp table _priced on commit drop as
  select c.product_id, c.quantity,
         p.name, p.image_url, p.mrp, p.selling_price, p.discount_pct,
         p.active and not p.archived as sellable,
         coalesce(i.available_qty, 0) as available_qty,
         (p.selling_price * c.quantity)::numeric(12,2) as line_total
  from _cart c
  join products p on p.id = c.product_id
  left join inventory i on i.product_id = c.product_id;

  if (select count(*) from _priced) <> (select count(*) from _cart) then
    return jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE',
      'message', 'Some items in your bucket no longer exist. Please refresh and try again.');
  end if;

  if exists (select 1 from _priced where not sellable) then
    return jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE',
      'message', 'Some items in your bucket are no longer for sale. Please remove them and try again.',
      'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'name', name))
                from _priced where not sellable));
  end if;

  select coalesce(sum(line_total), 0), coalesce(sum(quantity), 0)
    into v_subtotal, v_item_count from _priced;

  -- ---- minimum order value --------------------------------------------
  select coalesce(value::numeric, 0) into v_min_order
    from app_settings where key = 'min_order_value';
  if v_subtotal < coalesce(v_min_order, 0) then
    return jsonb_build_object('ok', false, 'code', 'MIN_ORDER_NOT_MET',
      'message', format('Minimum order value is ₹%s. Your bucket is ₹%s.',
                        v_min_order, v_subtotal),
      'min_order_value', v_min_order, 'subtotal', v_subtotal);
  end if;

  -- ---- stock check first: all-or-nothing --------------------------------
  -- Customers must hear about missing stock before any offer recalculation.
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product_id, 'name', name,
           'requested', quantity, 'available', greatest(available_qty, 0))), '[]'::jsonb)
    into v_shortages
  from _priced where quantity > available_qty;

  if jsonb_array_length(v_shortages) > 0 then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_STOCK',
      'message', 'Some items are no longer available in the requested quantity. Please update your bucket and try again.',
      'items', v_shortages);
  end if;

  -- ---- pick the highest qualifying offer whose gift is in stock -------
  for v_offer in
    select o.id, o.name, o.threshold, o.free_product_id, o.free_qty,
           p.name as free_product_name, p.image_url as free_product_image,
           p.mrp as free_product_mrp,
           p.active and not p.archived as gift_sellable,
           coalesce(i.available_qty, 0)
             - coalesce((select quantity from _cart c where c.product_id = o.free_product_id), 0)
             as gift_available
    from offers o
    join products p on p.id = o.free_product_id
    left join inventory i on i.product_id = o.free_product_id
    where o.active and not o.archived
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at >= now())
      and o.threshold <= v_subtotal
    order by o.threshold desc, o.priority desc, o.created_at asc
  loop
    if v_offer.gift_sellable and v_offer.gift_available >= v_offer.free_qty then
      v_ap_offer_id     := v_offer.id;
      v_ap_offer_name   := v_offer.name;
      v_ap_threshold    := v_offer.threshold;
      v_ap_product_id   := v_offer.free_product_id;
      v_ap_product_name := v_offer.free_product_name;
      v_ap_product_img  := v_offer.free_product_image;
      v_ap_product_mrp  := v_offer.free_product_mrp;
      v_ap_free_qty     := v_offer.free_qty;
      exit;
    end if;
  end loop;

  -- ---- the gift shown to the customer must match what we can honor ----
  if v_expected_offer is distinct from v_ap_offer_id then
    return jsonb_build_object('ok', false, 'code', 'OFFER_CHANGED',
      'message', 'The free gift for your order has changed. Please review your bucket and place the order again.',
      'applied_offer', case when v_ap_offer_id is null then null else
        jsonb_build_object('id', v_ap_offer_id, 'name', v_ap_offer_name,
          'free_product_name', v_ap_product_name,
          'free_qty', v_ap_free_qty, 'threshold', v_ap_threshold)
      end);
  end if;

  -- ---- allocate order number -------------------------------------------
  v_year := extract(year from now())::int;
  insert into order_counters as oc (year, last_value)
    values (v_year, 1)
    on conflict (year) do update set last_value = oc.last_value + 1
    returning last_value into v_counter;
  v_order_number := format('CS-%s-%s', v_year, lpad(v_counter::text, 6, '0'));

  -- ---- create order ------------------------------------------------------
  insert into orders (order_number, idempotency_key, customer_name, customer_phone,
                      location_id, location_snapshot, slot_snapshot, is_other_location,
                      customer_note, status, subtotal, total, item_count, applied_offer_id)
  values (v_order_number, v_key, v_name, v_phone,
          case when v_is_other then null else v_location_id end,
          v_location_snap, v_slot_snap, v_is_other,
          v_note, 'pending', v_subtotal, v_subtotal, v_item_count,
          v_ap_offer_id)
  returning id, access_token into v_order_id, v_token;

  insert into order_items (order_id, product_id, product_name, image_url, mrp,
                           unit_price, discount_pct, quantity, line_total, is_free)
  select v_order_id, product_id, name, image_url, mrp,
         selling_price, discount_pct, quantity, line_total, false
  from _priced;

  if v_ap_offer_id is not null then
    insert into order_items (order_id, product_id, product_name, image_url, mrp,
                             unit_price, discount_pct, quantity, line_total, is_free, offer_id)
    values (v_order_id, v_ap_product_id, v_ap_product_name,
            v_ap_product_img, v_ap_product_mrp,
            0, 0, v_ap_free_qty, 0, true, v_ap_offer_id);
  end if;

  -- ---- reserve stock + audit ---------------------------------------------
  update inventory i
     set reserved_qty = i.reserved_qty + c.quantity
    from _cart c where i.product_id = c.product_id;

  insert into inventory_audit (product_id, prev_total, change, new_total,
                               prev_reserved, new_reserved, reason, source, order_id)
  select i.product_id, i.total_qty, 0, i.total_qty,
         i.reserved_qty - c.quantity, i.reserved_qty,
         format('Reserved for order %s', v_order_number), 'order', v_order_id
  from inventory i join _cart c on c.product_id = i.product_id;

  if v_ap_offer_id is not null then
    update inventory
       set reserved_qty = reserved_qty + v_ap_free_qty
     where product_id = v_ap_product_id;

    insert into inventory_audit (product_id, prev_total, change, new_total,
                                 prev_reserved, new_reserved, reason, source, order_id)
    select i.product_id, i.total_qty, 0, i.total_qty,
           i.reserved_qty - v_ap_free_qty, i.reserved_qty,
           format('Free gift reserved for order %s', v_order_number), 'promo_gift', v_order_id
    from inventory i where i.product_id = v_ap_product_id;
  end if;

  insert into order_status_history (order_id, old_status, new_status, note)
  values (v_order_id, null, 'pending', 'Order placed by customer');

  -- ---- response -------------------------------------------------------------
  select jsonb_agg(jsonb_build_object(
           'product_name', oi.product_name, 'quantity', oi.quantity,
           'unit_price', oi.unit_price, 'mrp', oi.mrp,
           'discount_pct', oi.discount_pct, 'line_total', oi.line_total,
           'is_free', oi.is_free) order by oi.is_free, oi.id)
    into v_items_out
  from order_items oi where oi.order_id = v_order_id;

  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'access_token', v_token,
    'customer_name', v_name,
    'customer_phone', v_phone,
    'location', v_location_snap,
    'slot', v_slot_snap,
    'note', v_note,
    'subtotal', v_subtotal,
    'total', v_subtotal,
    'item_count', v_item_count,
    'items', v_items_out,
    'applied_offer', case when v_ap_offer_id is null then null else
      jsonb_build_object('name', v_ap_offer_name,
        'free_product_name', v_ap_product_name,
        'free_qty', v_ap_free_qty) end));
end $$;

-- place_order is only callable through the server (service role).
revoke execute on function place_order(jsonb) from public, anon, authenticated;

-- ---------- update_order_status ----------
-- Handles the inventory side-effects of each transition atomically.
create or replace function update_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_note text default ''
)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_admin uuid := auth.uid();
begin
  perform assert_admin();

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'message', 'Order not found.');
  end if;

  if v_order.status in ('collected', 'cancelled', 'expired') then
    return jsonb_build_object('ok', false, 'code', 'FINAL_STATUS',
      'message', format('Order is already %s and cannot be changed.', v_order.status));
  end if;

  if v_order.status = p_new_status then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  -- lock the inventory rows this order touches, in stable order
  perform 1 from inventory i
   where i.product_id in (select product_id from order_items where order_id = p_order_id)
   order by i.product_id for update of i;

  if p_new_status in ('cancelled', 'expired') then
    -- release the reservation
    update inventory i
       set reserved_qty = i.reserved_qty - s.qty
      from (select product_id, sum(quantity) as qty
              from order_items where order_id = p_order_id group by 1) s
     where i.product_id = s.product_id;

    insert into inventory_audit (product_id, prev_total, change, new_total,
                                 prev_reserved, new_reserved, reason, source, admin_id, order_id)
    select i.product_id, i.total_qty, 0, i.total_qty,
           i.reserved_qty + s.qty, i.reserved_qty,
           format('Reservation released — order %s %s', v_order.order_number, p_new_status),
           case when p_new_status = 'cancelled' then 'cancellation'::inventory_source
                else 'expiration'::inventory_source end,
           v_admin, p_order_id
      from inventory i
      join (select product_id, sum(quantity) as qty
              from order_items where order_id = p_order_id group by 1) s
        on s.product_id = i.product_id;

  elsif p_new_status = 'collected' then
    -- goods leave the shop: physical stock and reservation both drop
    update inventory i
       set total_qty = i.total_qty - s.qty,
           reserved_qty = i.reserved_qty - s.qty
      from (select product_id, sum(quantity) as qty
              from order_items where order_id = p_order_id group by 1) s
     where i.product_id = s.product_id;

    insert into inventory_audit (product_id, prev_total, change, new_total,
                                 prev_reserved, new_reserved, reason, source, admin_id, order_id)
    select i.product_id, i.total_qty + s.qty, -s.qty, i.total_qty,
           i.reserved_qty + s.qty, i.reserved_qty,
           format('Collected — order %s', v_order.order_number),
           'collection', v_admin, p_order_id
      from inventory i
      join (select product_id, sum(quantity) as qty
              from order_items where order_id = p_order_id group by 1) s
        on s.product_id = i.product_id;
  end if;

  update orders set status = p_new_status where id = p_order_id;

  insert into order_status_history (order_id, old_status, new_status, changed_by, note)
  values (p_order_id, v_order.status, p_new_status, v_admin, coalesce(p_note, ''));

  return jsonb_build_object('ok', true, 'order_number', v_order.order_number,
    'old_status', v_order.status, 'new_status', p_new_status);
end $$;

revoke execute on function update_order_status(uuid, order_status, text) from public, anon;

-- ---------- adjust_inventory (admin) ----------
create or replace function adjust_inventory(
  p_product_id uuid,
  p_mode text,            -- 'set' | 'increase' | 'decrease'
  p_qty int,
  p_reason text default ''
)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_inv inventory%rowtype;
  v_new_total int;
begin
  perform assert_admin();

  if p_qty is null or p_qty < 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Quantity must be zero or more.');
  end if;

  -- create the row on first touch
  insert into inventory (product_id, total_qty, reserved_qty)
  values (p_product_id, 0, 0)
  on conflict (product_id) do nothing;

  select * into v_inv from inventory where product_id = p_product_id for update;

  v_new_total := case p_mode
    when 'set'      then p_qty
    when 'increase' then v_inv.total_qty + p_qty
    when 'decrease' then v_inv.total_qty - p_qty
    else null end;

  if v_new_total is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Invalid adjustment mode.');
  end if;

  if v_new_total < 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT',
      'message', 'Stock cannot go below zero.');
  end if;

  if v_new_total < v_inv.reserved_qty then
    return jsonb_build_object('ok', false, 'code', 'BELOW_RESERVED',
      'message', format('Cannot set stock to %s — %s units are already reserved for open orders.',
                        v_new_total, v_inv.reserved_qty),
      'reserved_qty', v_inv.reserved_qty);
  end if;

  update inventory set total_qty = v_new_total where product_id = p_product_id;

  insert into inventory_audit (product_id, prev_total, change, new_total,
                               prev_reserved, new_reserved, reason, source, admin_id)
  values (p_product_id, v_inv.total_qty, v_new_total - v_inv.total_qty, v_new_total,
          v_inv.reserved_qty, v_inv.reserved_qty,
          coalesce(nullif(trim(p_reason), ''), 'Manual adjustment'), 'manual', auth.uid());

  return jsonb_build_object('ok', true, 'total_qty', v_new_total,
    'reserved_qty', v_inv.reserved_qty, 'available_qty', v_new_total - v_inv.reserved_qty);
end $$;

revoke execute on function adjust_inventory(uuid, text, int, text) from public, anon;

-- ---------- search_products (public catalog) ----------
create or replace function search_products(
  p_query text default null,
  p_category_slug text default null,
  p_sort text default 'newest',       -- newest | price_asc | price_desc | popularity
  p_filter text default null,         -- null | 'low_stock' | 'in_stock'
  p_page int default 1,
  p_page_size int default 24
)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 24), 1), 60);
  v_threshold int;
  v_total bigint;
  v_items jsonb;
begin
  select coalesce(value::int, 10) into v_threshold
    from app_settings where key = 'low_stock_threshold';

  with base as (
    select p.id, p.name, p.description, p.image_url,
           p.mrp, p.selling_price, p.discount_pct, p.created_at,
           c.name as category_name, c.slug as category_slug,
           coalesce(i.available_qty, 0) as available_qty,
           coalesce(pop.units, 0) as units_ordered
    from products p
    left join categories c on c.id = p.category_id
    left join inventory i on i.product_id = p.id
    left join (
      select oi.product_id, sum(oi.quantity) as units
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.status not in ('cancelled', 'expired') and not oi.is_free
      group by oi.product_id
    ) pop on pop.product_id = p.id
    where p.active and not p.archived
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_query is null or trim(p_query) = ''
           or p.name ilike '%' || trim(p_query) || '%'
           or p.description ilike '%' || trim(p_query) || '%'
           or c.name ilike '%' || trim(p_query) || '%'
           or exists (select 1 from product_tags t
                      where t.product_id = p.id
                        and t.tag ilike '%' || trim(p_query) || '%'))
      and (p_filter is distinct from 'low_stock'
           or (coalesce(i.available_qty, 0) > 0 and coalesce(i.available_qty, 0) <= v_threshold))
      and (p_filter is distinct from 'in_stock' or coalesce(i.available_qty, 0) > 0)
  ),
  counted as (select count(*) as n from base),
  paged as (
    select * from base
    order by
      case when p_sort = 'price_asc'  then selling_price end asc,
      case when p_sort = 'price_desc' then selling_price end desc,
      case when p_sort = 'popularity' then units_ordered end desc,
      case when p_filter = 'low_stock' then available_qty end asc,
      created_at desc, id
    limit v_size offset (v_page - 1) * v_size
  )
  select (select n from counted),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'description', description,
           'image_url', image_url, 'mrp', mrp, 'selling_price', selling_price,
           'discount_pct', discount_pct,
           'category_name', category_name, 'category_slug', category_slug,
           'available_qty', available_qty, 'units_ordered', units_ordered)), '[]'::jsonb)
    into v_total, v_items
  from paged;

  return jsonb_build_object('items', v_items, 'total', v_total,
    'page', v_page, 'page_size', v_size, 'low_stock_threshold', v_threshold);
end $$;

grant execute on function search_products(text, text, text, text, int, int) to anon, authenticated;

-- ---------- get_offer_tiers (public) ----------
create or replace function get_offer_tiers()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(t order by (t ->> 'threshold')::numeric), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', o.id, 'name', o.name, 'threshold', o.threshold,
      'free_qty', o.free_qty,
      'free_product_id', o.free_product_id,
      'free_product_name', p.name,
      'free_product_image', p.image_url,
      'in_stock', p.active and not p.archived
                  and coalesce(i.available_qty, 0) >= o.free_qty) as t
    from offers o
    join products p on p.id = o.free_product_id
    left join inventory i on i.product_id = o.free_product_id
    where o.active and not o.archived
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at >= now())
  ) x;
$$;

grant execute on function get_offer_tiers() to anon, authenticated;

-- ---------- lookup_order (public, verified) ----------
-- Accepts order number + (access token OR the phone number used on the order).
create or replace function lookup_order(
  p_order_number text,
  p_token uuid default null,
  p_phone text default null
)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  select * into v_order from orders
   where upper(order_number) = upper(trim(coalesce(p_order_number, '')));
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'message', 'No order found with that Order ID.');
  end if;

  if not (
    (p_token is not null and p_token = v_order.access_token)
    or (length(v_phone) >= 10 and right(v_phone, 10) = right(v_order.customer_phone, 10))
  ) then
    return jsonb_build_object('ok', false, 'code', 'VERIFY_FAILED',
      'message', 'The details you entered do not match this order.');
  end if;

  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'location', v_order.location_snapshot,
    'slot', v_order.slot_snapshot,
    'is_other_location', v_order.is_other_location,
    'note', v_order.customer_note,
    'subtotal', v_order.subtotal,
    'total', v_order.total,
    'item_count', v_order.item_count,
    'created_at', v_order.created_at,
    'items', (select jsonb_agg(jsonb_build_object(
                'product_name', oi.product_name, 'image_url', oi.image_url,
                'quantity', oi.quantity, 'unit_price', oi.unit_price,
                'mrp', oi.mrp, 'discount_pct', oi.discount_pct,
                'line_total', oi.line_total, 'is_free', oi.is_free)
                order by oi.is_free, oi.id)
              from order_items oi where oi.order_id = v_order.id)));
end $$;

grant execute on function lookup_order(text, uuid, text) to anon, authenticated;


-- ============================ RLS ==================================
-- =============================================================
-- Closing Sale — Row Level Security
--
-- Principles:
--  * Customers (anon) can only read public catalog data.
--  * Orders are never readable/writable by anon directly — order
--    creation goes through place_order (service role) and reads go
--    through lookup_order (verified by token or phone).
--  * Admins (rows in admin_users) manage catalog data directly;
--    inventory quantities and order statuses change ONLY through the
--    audited RPCs (adjust_inventory, update_order_status, place_order).
-- =============================================================

alter table app_settings          enable row level security;
alter table admin_users           enable row level security;
alter table categories            enable row level security;
alter table products              enable row level security;
alter table product_tags          enable row level security;
alter table inventory             enable row level security;
alter table inventory_audit       enable row level security;
alter table offers                enable row level security;
alter table locations             enable row level security;
alter table collection_slots      enable row level security;
alter table order_counters        enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table order_status_history  enable row level security;

-- ---------- app_settings ----------
create policy settings_public_read on app_settings
  for select using (public or is_admin());
create policy settings_admin_write on app_settings
  for update using (is_admin()) with check (is_admin());

-- ---------- admin_users ----------
create policy admin_users_self_read on admin_users
  for select using (user_id = auth.uid() or is_admin());

-- ---------- categories ----------
create policy categories_public_read on categories
  for select using (active or is_admin());
create policy categories_admin_all on categories
  for all using (is_admin()) with check (is_admin());

-- ---------- products ----------
create policy products_public_read on products
  for select using ((active and not archived) or is_admin());
create policy products_admin_all on products
  for all using (is_admin()) with check (is_admin());

-- ---------- product_tags ----------
create policy product_tags_public_read on product_tags
  for select using (
    is_admin() or exists (
      select 1 from products p
      where p.id = product_id and p.active and not p.archived));
create policy product_tags_admin_all on product_tags
  for all using (is_admin()) with check (is_admin());

-- ---------- inventory ----------
-- Read-only for everyone; ALL quantity changes go through audited RPCs.
create policy inventory_public_read on inventory
  for select using (true);

-- ---------- inventory_audit ----------
create policy inventory_audit_admin_read on inventory_audit
  for select using (is_admin());

-- ---------- offers ----------
create policy offers_public_read on offers
  for select using ((active and not archived) or is_admin());
create policy offers_admin_all on offers
  for all using (is_admin()) with check (is_admin());

-- ---------- locations ----------
create policy locations_public_read on locations
  for select using ((not archived and status <> 'disabled') or is_admin());
create policy locations_admin_all on locations
  for all using (is_admin()) with check (is_admin());

-- ---------- collection_slots ----------
create policy slots_public_read on collection_slots
  for select using (
    is_admin() or (active and exists (
      select 1 from locations l
      where l.id = location_id and not l.archived and l.status <> 'disabled')));
create policy slots_admin_all on collection_slots
  for all using (is_admin()) with check (is_admin());

-- ---------- orders (admin read-only; mutations via RPCs) ----------
create policy orders_admin_read on orders
  for select using (is_admin());
create policy order_items_admin_read on order_items
  for select using (is_admin());
create policy order_status_history_admin_read on order_status_history
  for select using (is_admin());

-- order_counters: no client access at all (service role only).


-- ============================ ADMIN FUNCTIONS ======================
-- =============================================================
-- Closing Sale — admin dashboard functions (run after 0001–0003)
-- =============================================================

-- ---------- dashboard stats ----------
create or replace function admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_threshold int;
  v jsonb;
begin
  perform assert_admin();

  select coalesce(value::int, 10) into v_threshold
    from app_settings where key = 'low_stock_threshold';

  select jsonb_build_object(
    'low_stock_threshold', v_threshold,
    'active_products', (select count(*) from products where active and not archived),
    'archived_products', (select count(*) from products where archived),
    'total_stock_units', coalesce((select sum(total_qty) from inventory), 0),
    'reserved_units', coalesce((select sum(reserved_qty) from inventory), 0),
    'available_units', coalesce((select sum(available_qty) from inventory), 0),
    'low_stock_count', (
      select count(*) from products p join inventory i on i.product_id = p.id
      where p.active and not p.archived
        and i.available_qty > 0 and i.available_qty <= v_threshold),
    'out_of_stock_count', (
      select count(*) from products p left join inventory i on i.product_id = p.id
      where p.active and not p.archived and coalesce(i.available_qty, 0) <= 0),
    'orders', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*) as n from orders group by status) s),
    'total_orders', (select count(*) from orders),
    'order_value_total', coalesce((
      select sum(total) from orders where status not in ('cancelled', 'expired')), 0),
    'order_value_collected', coalesce((
      select sum(total) from orders where status = 'collected'), 0),
    'units_sold', coalesce((
      select sum(oi.quantity) from order_items oi
      join orders o on o.id = oi.order_id
      where o.status not in ('cancelled', 'expired') and not oi.is_free), 0),
    'free_units_given', coalesce((
      select sum(oi.quantity) from order_items oi
      join orders o on o.id = oi.order_id
      where o.status not in ('cancelled', 'expired') and oi.is_free), 0)
  ) into v;

  return v;
end $$;

revoke execute on function admin_dashboard_stats() from public, anon;

-- ---------- top 10 lowest inventory (active products at/below threshold) ----------
create or replace function admin_top_low_stock(p_limit int default 10)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_threshold int;
  v jsonb;
begin
  perform assert_admin();

  select coalesce(value::int, 10) into v_threshold
    from app_settings where key = 'low_stock_threshold';

  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'product_id', p.id, 'name', p.name,
      'selling_price', p.selling_price,
      'total_qty', coalesce(i.total_qty, 0),
      'reserved_qty', coalesce(i.reserved_qty, 0),
      'available_qty', coalesce(i.available_qty, 0),
      'out_of_stock', coalesce(i.available_qty, 0) <= 0
    ) as row_data
    from products p
    left join inventory i on i.product_id = p.id
    where p.active and not p.archived
      and coalesce(i.available_qty, 0) <= v_threshold
    order by coalesce(i.available_qty, 0) asc, p.name
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) x;

  return v;
end $$;

revoke execute on function admin_top_low_stock(int) from public, anon;

-- ---------- top 10 most-ordered (excludes cancelled/expired and free items) ----------
create or replace function admin_top_ordered(p_limit int default 10)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  perform assert_admin();

  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'product_id', oi.product_id,
      'name', max(oi.product_name),
      'units_ordered', sum(oi.quantity),
      'revenue', sum(oi.line_total)
    ) as row_data
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.status not in ('cancelled', 'expired') and not oi.is_free
    group by oi.product_id
    order by sum(oi.quantity) desc, sum(oi.line_total) desc
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) x;

  return v;
end $$;

revoke execute on function admin_top_ordered(int) from public, anon;

-- ---------- helpers ----------
create or replace function safe_numeric(p text)
returns numeric
language plpgsql immutable
set search_path = public, pg_temp
as $$
begin
  return p::numeric;
exception when others then
  return null;
end $$;

-- ---------- bulk CSV import ----------
-- p_rows: [{name, description, category, tags: [..], mrp, selling_price,
--           quantity, active}]
-- p_dry_run = true  -> validate only, report per-row errors, insert nothing
-- p_dry_run = false -> all-or-nothing import (any invalid row aborts)
create or replace function bulk_import_products(p_rows jsonb, p_dry_run boolean default true)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_errors jsonb := '[]'::jsonb;
  v_row_errors text[];
  v_name text;
  v_desc text;
  v_cat_name text;
  v_mrp numeric;
  v_price numeric;
  v_qty numeric;
  v_active boolean;
  v_idx int := 0;
  v_cat_id uuid;
  v_slug text;
  v_product_id uuid;
  v_imported int := 0;
  v_tag text;
begin
  perform assert_admin();

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return jsonb_build_object('ok', false, 'errors',
      jsonb_build_array(jsonb_build_object('row', 0, 'errors', jsonb_build_array('No rows to import.'))));
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    return jsonb_build_object('ok', false, 'errors',
      jsonb_build_array(jsonb_build_object('row', 0, 'errors', jsonb_build_array('Too many rows (max 2000 per import).'))));
  end if;

  -- ---- validate every row ----
  for r in select value, ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    v_idx := r.ordinality;
    v_row_errors := '{}';

    v_name  := trim(coalesce(r.value ->> 'name', ''));
    v_cat_name := trim(coalesce(r.value ->> 'category', ''));
    v_mrp   := safe_numeric(trim(coalesce(r.value ->> 'mrp', '')));
    v_price := safe_numeric(trim(coalesce(r.value ->> 'selling_price', '')));
    v_qty   := safe_numeric(trim(coalesce(r.value ->> 'quantity', '')));

    if length(v_name) < 2 then
      v_row_errors := v_row_errors || 'Product name is required (min 2 characters).';
    end if;
    if v_mrp is null or v_mrp <= 0 then
      v_row_errors := v_row_errors || 'MRP must be a positive number.';
    end if;
    if v_price is null or v_price <= 0 then
      v_row_errors := v_row_errors || 'Selling price must be a positive number.';
    end if;
    if v_mrp is not null and v_price is not null and v_price > v_mrp then
      v_row_errors := v_row_errors || 'Selling price cannot be higher than MRP.';
    end if;
    if v_qty is null or v_qty < 0 or v_qty <> floor(v_qty) then
      v_row_errors := v_row_errors || 'Quantity must be a whole number, zero or more.';
    end if;
    if length(v_name) >= 2 and exists (
        select 1 from products where lower(name) = lower(v_name) and not archived) then
      v_row_errors := v_row_errors || 'A product with this name already exists.';
    end if;

    if array_length(v_row_errors, 1) > 0 then
      v_errors := v_errors || jsonb_build_object(
        'row', v_idx, 'name', v_name, 'errors', to_jsonb(v_row_errors));
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'dry_run', p_dry_run, 'errors', v_errors);
  end if;
  if p_dry_run then
    return jsonb_build_object('ok', true, 'dry_run', true,
      'valid_rows', jsonb_array_length(p_rows));
  end if;

  -- ---- import (single transaction: any failure rolls back everything) ----
  for r in select value, ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    v_name  := trim(r.value ->> 'name');
    v_desc  := trim(coalesce(r.value ->> 'description', ''));
    v_cat_name := trim(coalesce(r.value ->> 'category', ''));
    v_mrp   := (r.value ->> 'mrp')::numeric;
    v_price := (r.value ->> 'selling_price')::numeric;
    v_qty   := (r.value ->> 'quantity')::numeric;
    v_active := lower(trim(coalesce(r.value ->> 'active', 'true')))
                in ('true', 'yes', '1', 'y', 'active');

    -- resolve or create the category
    v_cat_id := null;
    if v_cat_name <> '' then
      select id into v_cat_id from categories where lower(name) = lower(v_cat_name);
      if v_cat_id is null then
        v_slug := trim(both '-' from regexp_replace(lower(v_cat_name), '[^a-z0-9]+', '-', 'g'));
        insert into categories (name, slug, sort_order)
        values (v_cat_name, v_slug, 100)
        returning id into v_cat_id;
      end if;
    end if;

    insert into products (name, description, category_id, mrp, selling_price, active)
    values (v_name, v_desc, v_cat_id, round(v_mrp, 2), round(v_price, 2), v_active)
    returning id into v_product_id;

    for v_tag in select distinct trim(t.value) from jsonb_array_elements_text(
        coalesce(r.value -> 'tags', '[]'::jsonb)) as t where trim(t.value) <> ''
    loop
      insert into product_tags (product_id, tag) values (v_product_id, lower(v_tag))
      on conflict do nothing;
    end loop;

    insert into inventory (product_id, total_qty) values (v_product_id, v_qty::int);

    insert into inventory_audit (product_id, prev_total, change, new_total,
                                 prev_reserved, new_reserved, reason, source, admin_id)
    values (v_product_id, 0, v_qty::int, v_qty::int, 0, 0,
            'Bulk CSV import', 'bulk_import', auth.uid());

    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object('ok', true, 'dry_run', false, 'imported', v_imported);
end $$;

revoke execute on function bulk_import_products(jsonb, boolean) from public, anon;


-- ============================ DEMO SEED DATA =======================
-- =============================================================
-- Closing Sale — DEVELOPMENT SEED DATA
-- Everything here is demo data. Remove before production:
--   run supabase/reset_demo_data.sql or delete rows tagged [DEMO].
-- =============================================================

-- ---------- settings ----------
update app_settings set value = 'Sharma General Store' where key = 'shop_name';
update app_settings set value = 'CLOSING SALE — Everything Must Go!' where key = 'sale_title';
update app_settings set value = 'After 22 years we are closing our doors. Every item is at a genuine clearance price. Stock is limited — reserve now, collect and pay at pickup.' where key = 'sale_message';
update app_settings set value = '500' where key = 'min_order_value';
update app_settings set value = '10' where key = 'low_stock_threshold';
update app_settings set value = '12, Main Market Road, Sector 15, Gurugram' where key = 'shop_address';
update app_settings set value = '10:00 AM – 8:00 PM, Monday to Sunday' where key = 'shop_timings';
update app_settings set value = '919999900000' where key = 'whatsapp_number';

-- ---------- categories ----------
insert into categories (id, name, slug, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'Kitchen & Dining',   'kitchen-dining',   1),
  ('c0000000-0000-4000-8000-000000000002', 'Home & Storage',     'home-storage',     2),
  ('c0000000-0000-4000-8000-000000000003', 'Stationery',         'stationery',       3),
  ('c0000000-0000-4000-8000-000000000004', 'Toys & Games',       'toys-games',       4),
  ('c0000000-0000-4000-8000-000000000005', 'Personal Care',      'personal-care',    5),
  ('c0000000-0000-4000-8000-000000000006', 'Electronics & Misc', 'electronics-misc', 6);

-- ---------- products ----------
insert into products (id, name, description, category_id, mrp, selling_price) values
  ('a0000000-0000-4000-8000-000000000001', 'Stainless Steel Water Bottle 1L',
   '[DEMO] Insulated single-wall steel bottle, leak-proof cap. Perfect for school and office.',
   'c0000000-0000-4000-8000-000000000001', 499.00, 249.00),
  ('a0000000-0000-4000-8000-000000000002', 'Non-Stick Frying Pan 24cm',
   '[DEMO] Durable non-stick coating, cool-touch handle. Gas and induction compatible.',
   'c0000000-0000-4000-8000-000000000001', 1199.00, 599.00),
  ('a0000000-0000-4000-8000-000000000003', 'Melamine Dinner Set (18 pieces)',
   '[DEMO] Elegant floral print, chip-resistant, family pack of 18 pieces.',
   'c0000000-0000-4000-8000-000000000001', 1999.00, 999.00),
  ('a0000000-0000-4000-8000-000000000004', 'Glass Storage Jars (Set of 3)',
   '[DEMO] Airtight bamboo lids. 500ml, 750ml, 1L. Ideal for pulses and spices.',
   'c0000000-0000-4000-8000-000000000001', 899.00, 449.00),
  ('a0000000-0000-4000-8000-000000000005', 'Plastic Storage Boxes (Set of 5)',
   '[DEMO] Stackable, transparent with colored lids. Assorted sizes.',
   'c0000000-0000-4000-8000-000000000002', 799.00, 399.00),
  ('a0000000-0000-4000-8000-000000000006', 'Cotton Double Bedsheet with Pillow Covers',
   '[DEMO] 100% cotton, 240 TC, king size with 2 pillow covers. Assorted designs.',
   'c0000000-0000-4000-8000-000000000002', 1499.00, 749.00),
  ('a0000000-0000-4000-8000-000000000007', 'Door Mat Anti-Slip (Pack of 2)',
   '[DEMO] Coir + rubber base, absorbs water, easy to wash.',
   'c0000000-0000-4000-8000-000000000002', 499.00, 199.00),
  ('a0000000-0000-4000-8000-000000000008', 'Classmate Notebooks 172 pages (Pack of 6)',
   '[DEMO] Single line, soft cover. School essential pack.',
   'c0000000-0000-4000-8000-000000000003', 360.00, 288.00),
  ('a0000000-0000-4000-8000-000000000009', 'Gel Pens Assorted Colors (Pack of 10)',
   '[DEMO] Smooth-flow gel pens, 10 colors, 0.7mm tip.',
   'c0000000-0000-4000-8000-000000000003', 250.00, 125.00),
  ('a0000000-0000-4000-8000-000000000010', 'Art & Craft Kit for Kids',
   '[DEMO] Crayons, sketch pens, watercolors, drawing book and stickers in one box.',
   'c0000000-0000-4000-8000-000000000003', 699.00, 349.00),
  ('a0000000-0000-4000-8000-000000000011', 'Remote Control Racing Car',
   '[DEMO] Rechargeable RC car with LED lights. For ages 5+.',
   'c0000000-0000-4000-8000-000000000004', 1499.00, 749.00),
  ('a0000000-0000-4000-8000-000000000012', 'Ludo + Snakes & Ladders Board Set',
   '[DEMO] Classic 2-in-1 family board game with wooden tokens.',
   'c0000000-0000-4000-8000-000000000004', 399.00, 199.00),
  ('a0000000-0000-4000-8000-000000000013', 'Building Blocks Set (120 pieces)',
   '[DEMO] Colorful interlocking blocks, compatible with standard brands.',
   'c0000000-0000-4000-8000-000000000004', 999.00, 499.00),
  ('a0000000-0000-4000-8000-000000000014', 'Herbal Bath Soap (Pack of 8)',
   '[DEMO] Neem and aloe vera soaps, 100g each.',
   'c0000000-0000-4000-8000-000000000005', 320.00, 199.00),
  ('a0000000-0000-4000-8000-000000000015', 'Hair Oil & Shampoo Combo',
   '[DEMO] Coconut hair oil 300ml + anti-dandruff shampoo 340ml.',
   'c0000000-0000-4000-8000-000000000005', 550.00, 330.00),
  ('a0000000-0000-4000-8000-000000000016', 'LED Emergency Bulb 9W',
   '[DEMO] Rechargeable inverter bulb, up to 4 hours backup. B22 holder.',
   'c0000000-0000-4000-8000-000000000006', 599.00, 299.00),
  ('a0000000-0000-4000-8000-000000000017', 'Extension Board 4 Socket + USB',
   '[DEMO] 2m cord, surge protection, 2 USB charging ports.',
   'c0000000-0000-4000-8000-000000000006', 899.00, 499.00),
  ('a0000000-0000-4000-8000-000000000018', 'Wall Clock 12 inch',
   '[DEMO] Silent sweep movement, classic wooden finish frame.',
   'c0000000-0000-4000-8000-000000000006', 799.00, 349.00),
  -- promotional gift products
  ('a0000000-0000-4000-8000-000000000019', 'Steel Lunch Box (Gift Item)',
   '[DEMO] Compact 2-container steel tiffin. Featured as a free gift item.',
   'c0000000-0000-4000-8000-000000000001', 299.00, 149.00),
  ('a0000000-0000-4000-8000-000000000020', 'Insulated Casserole 1.5L (Gift Item)',
   '[DEMO] Keeps rotis warm for hours. Featured as a free gift item.',
   'c0000000-0000-4000-8000-000000000001', 699.00, 349.00);

-- ---------- tags ----------
insert into product_tags (product_id, tag) values
  ('a0000000-0000-4000-8000-000000000001', 'bottle'), ('a0000000-0000-4000-8000-000000000001', 'steel'), ('a0000000-0000-4000-8000-000000000001', 'water'),
  ('a0000000-0000-4000-8000-000000000002', 'pan'), ('a0000000-0000-4000-8000-000000000002', 'cookware'), ('a0000000-0000-4000-8000-000000000002', 'kitchen'),
  ('a0000000-0000-4000-8000-000000000003', 'dinner set'), ('a0000000-0000-4000-8000-000000000003', 'plates'),
  ('a0000000-0000-4000-8000-000000000004', 'jars'), ('a0000000-0000-4000-8000-000000000004', 'storage'),
  ('a0000000-0000-4000-8000-000000000005', 'boxes'), ('a0000000-0000-4000-8000-000000000005', 'organizer'),
  ('a0000000-0000-4000-8000-000000000006', 'bedsheet'), ('a0000000-0000-4000-8000-000000000006', 'cotton'),
  ('a0000000-0000-4000-8000-000000000007', 'doormat'), ('a0000000-0000-4000-8000-000000000007', 'mat'),
  ('a0000000-0000-4000-8000-000000000008', 'notebook'), ('a0000000-0000-4000-8000-000000000008', 'school'),
  ('a0000000-0000-4000-8000-000000000009', 'pens'), ('a0000000-0000-4000-8000-000000000009', 'stationery'),
  ('a0000000-0000-4000-8000-000000000010', 'craft'), ('a0000000-0000-4000-8000-000000000010', 'kids'),
  ('a0000000-0000-4000-8000-000000000011', 'toy'), ('a0000000-0000-4000-8000-000000000011', 'car'), ('a0000000-0000-4000-8000-000000000011', 'remote control'),
  ('a0000000-0000-4000-8000-000000000012', 'board game'), ('a0000000-0000-4000-8000-000000000012', 'ludo'),
  ('a0000000-0000-4000-8000-000000000013', 'blocks'), ('a0000000-0000-4000-8000-000000000013', 'lego'),
  ('a0000000-0000-4000-8000-000000000014', 'soap'), ('a0000000-0000-4000-8000-000000000014', 'bath'),
  ('a0000000-0000-4000-8000-000000000015', 'shampoo'), ('a0000000-0000-4000-8000-000000000015', 'hair oil'),
  ('a0000000-0000-4000-8000-000000000016', 'bulb'), ('a0000000-0000-4000-8000-000000000016', 'led'), ('a0000000-0000-4000-8000-000000000016', 'emergency'),
  ('a0000000-0000-4000-8000-000000000017', 'extension'), ('a0000000-0000-4000-8000-000000000017', 'socket'), ('a0000000-0000-4000-8000-000000000017', 'usb'),
  ('a0000000-0000-4000-8000-000000000018', 'clock'), ('a0000000-0000-4000-8000-000000000018', 'wall clock'),
  ('a0000000-0000-4000-8000-000000000019', 'lunch box'), ('a0000000-0000-4000-8000-000000000019', 'tiffin'),
  ('a0000000-0000-4000-8000-000000000020', 'casserole'), ('a0000000-0000-4000-8000-000000000020', 'hotpot');

-- ---------- inventory ----------
insert into inventory (product_id, total_qty) values
  ('a0000000-0000-4000-8000-000000000001', 48),
  ('a0000000-0000-4000-8000-000000000002', 22),
  ('a0000000-0000-4000-8000-000000000003',  9),   -- low stock
  ('a0000000-0000-4000-8000-000000000004', 35),
  ('a0000000-0000-4000-8000-000000000005', 27),
  ('a0000000-0000-4000-8000-000000000006', 14),
  ('a0000000-0000-4000-8000-000000000007', 60),
  ('a0000000-0000-4000-8000-000000000008', 80),
  ('a0000000-0000-4000-8000-000000000009', 45),
  ('a0000000-0000-4000-8000-000000000010',  5),   -- very low stock
  ('a0000000-0000-4000-8000-000000000011',  2),   -- almost gone
  ('a0000000-0000-4000-8000-000000000012', 33),
  ('a0000000-0000-4000-8000-000000000013', 18),
  ('a0000000-0000-4000-8000-000000000014', 52),
  ('a0000000-0000-4000-8000-000000000015', 24),
  ('a0000000-0000-4000-8000-000000000016',  0),   -- out of stock
  ('a0000000-0000-4000-8000-000000000017', 16),
  ('a0000000-0000-4000-8000-000000000018',  7),   -- low stock
  ('a0000000-0000-4000-8000-000000000019', 40),   -- gift stock
  ('a0000000-0000-4000-8000-000000000020', 25);   -- gift stock

-- ---------- offers (tiered free gifts) ----------
insert into offers (name, threshold, free_product_id, free_qty, priority) values
  ('Free Steel Lunch Box on orders above ₹1,000',        1000.00, 'a0000000-0000-4000-8000-000000000019', 1, 1),
  ('Free Insulated Casserole on orders above ₹2,000',    2000.00, 'a0000000-0000-4000-8000-000000000020', 1, 1);

-- ---------- collection locations ----------
insert into locations (id, name, area, description, status, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'Green Valley Society Gate 2',
   'Sector 15, Gurugram', 'Collection table near Gate 2 security cabin.', 'confirmed', 1),
  ('b0000000-0000-4000-8000-000000000002', 'Sunrise Apartments Club House',
   'Sector 21, Gurugram', 'Inside the club house main hall.', 'confirmed', 2),
  ('b0000000-0000-4000-8000-000000000003', 'Palm Residency',
   'Sector 9, Gurugram', 'Schedule to be announced. We will notify soon.', 'coming_soon', 3);

insert into collection_slots (location_id, slot_date, start_time, end_time, notes) values
  ('b0000000-0000-4000-8000-000000000001', current_date + 3, '17:00', '20:00', 'Bring your Order ID.'),
  ('b0000000-0000-4000-8000-000000000001', current_date + 4, '10:00', '13:00', ''),
  ('b0000000-0000-4000-8000-000000000002', current_date + 5, '17:00', '20:00', 'Parking available inside.');
