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
