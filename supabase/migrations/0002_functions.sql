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

  -- ---- stock check: all-or-nothing ------------------------------------
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
