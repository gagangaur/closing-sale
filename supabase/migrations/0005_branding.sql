-- =============================================================
-- Closing Sale — branding update (Radha Krishna Book Depo)
-- Safe to run more than once. Only overwrites settings that still hold
-- the old demo/default text, so values an admin already typed are kept.
-- Everything here is also editable in Admin → Settings.
-- =============================================================

-- new hero content keys (no-op if they already exist)
insert into app_settings (key, value, public) values
  ('sale_subtitle',     'Heavy Discount SALE',                         true),
  ('legacy_badge',      '28 years · A family business',                true),
  ('thank_you_message', 'Thank you, Mathura, for 28 wonderful years.', true),
  ('sale_days',         'ONLY ON SATURDAY & SUNDAY',                   true)
on conflict (key) do nothing;

update app_settings set value = 'Radha Krishna Book Depo'
 where key = 'shop_name'
   and value in ('My Shop', 'Sharma General Store');

update app_settings set value = 'CLOSING SALE'
 where key = 'sale_title'
   and value in ('CLOSING SALE — Everything Must Go!', 'CLOSING SALE â€” Everything Must Go!');

update app_settings set value = 'After 28 years, we are closing our doors due to an unfortunate and deeply personal circumstance.'
 where key = 'sale_message'
   and (value like 'After 22 years%' or value like 'The shop is closing. Everything must go%');

update app_settings set value = 'Saturday & Sunday only, 10:00 AM – 8:00 PM'
 where key = 'shop_timings'
   and value in ('10:00 AM – 8:00 PM, Monday to Sunday', '10:00 AM – 8:00 PM, all days');

update app_settings set value = 'Mathura — exact shop address will be updated shortly'
 where key = 'shop_address'
   and value in ('12, Main Market Road, Sector 15, Gurugram', 'Shop address not configured yet');

-- demo collection locations: Gurugram → Mathura (demo rows only, matched by id)
update locations set area = 'Krishna Nagar, Mathura'
 where id = 'b0000000-0000-4000-8000-000000000001' and area like '%Gurugram%';
update locations set area = 'Govardhan Road, Mathura'
 where id = 'b0000000-0000-4000-8000-000000000002' and area like '%Gurugram%';
update locations set area = 'Vrindavan Road, Mathura'
 where id = 'b0000000-0000-4000-8000-000000000003' and area like '%Gurugram%';
