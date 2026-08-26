-- =============================================================
-- REMOVE DEMO DATA before going live with real products.
-- Deletes everything created by seed.sql (products marked [DEMO],
-- demo categories, offers, locations and any orders placed against
-- demo products). Settings are KEPT — review them in Admin → Settings.
--
-- ⚠ This deletes ALL existing orders. Only run before the real sale starts.
-- =============================================================

begin;

delete from order_status_history;
delete from order_items;
delete from orders;
delete from inventory_audit;
delete from offers;
delete from collection_slots;
delete from locations;
delete from inventory;
delete from product_tags;
delete from products;
delete from categories;

-- restart order numbering for the real sale
delete from order_counters;

commit;

-- After this: add your real products (Admin → Products or CSV import),
-- offers, collection locations, and verify Admin → Settings
-- (shop name, WhatsApp number, minimum order, address, timings).
