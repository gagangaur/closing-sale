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
