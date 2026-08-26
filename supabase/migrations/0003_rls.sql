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
