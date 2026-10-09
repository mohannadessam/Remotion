-- Trukni demo seed (local/dev only). Every demo phone signs in with OTP 123456
-- (see [auth.sms.test_otp] in supabase/config.toml).
--
--   +966500000001  customer (سارة)
--   +966500000002..07  vendors, one approved truck each
--   +966500000008  vendor with a pending application
--   +966500000009  admin
--   +966500000010..20  free numbers for trying signup

-- ---------------------------------------------------------------------------
-- Auth users (profiles are created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  ('00000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'authenticated', 'authenticated',
  '9665000000' || lpad(n::text, 2, '0'),
  now(),
  '{"provider":"phone","providers":["phone"]}'::jsonb,
  '{}'::jsonb,
  now(), now(),
  '', '', '', '', '', '', '', ''
from unnest(array[1, 2, 3, 4, 5, 6, 7, 8, 9]) as n;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text, 'phone',
  jsonb_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true),
  now(), now(), now()
from auth.users u
where u.id::text like '00000000-0000-4000-8000-0000000000%';

update public.profiles set full_name = 'سارة العتيبي' where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'مدير تركني', role = 'admin' where id = '00000000-0000-4000-8000-000000000009';

-- ---------------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------------
insert into public.vendors (id, owner_id, business_name, cr_number, municipality_license_no, status, reviewed_at)
values
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'مؤسسة الحارة للوجبات', '1010000002', 'RYD-40002', 'approved', now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'مؤسسة الديرة', '1010000003', 'RYD-40003', 'approved', now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'شركة الدرب للقهوة', '1010000004', 'RYD-40004', 'approved', now()),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'حلا السمرة التجارية', '1010000005', 'RYD-40005', 'approved', now()),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 'مندي عالماشي', '1010000006', 'RYD-40006', 'approved', now()),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', 'تاكو الصحراء', '1010000007', 'RYD-40007', 'approved', now()),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', 'كبدة أبو فهد', '1010000008', 'RYD-40008', 'pending', null);

update public.profiles set role = 'vendor', full_name = v.business_name
from public.vendors v where v.owner_id = profiles.id;

-- ---------------------------------------------------------------------------
-- Trucks (all within 10 km of central Riyadh)
-- ---------------------------------------------------------------------------
insert into public.trucks (
  id, vendor_id, name_ar, name_en, cuisine, description_ar, description_en,
  is_online, location, crowd_mode, manual_crowd, avg_prep_minutes, parallelism, slot_capacity,
  delivery_enabled, delivery_radius_m, delivery_fee
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   'برجر الحارة', 'Al Hara Burger', 'burgers',
   'برجر سماش على الفحم، لحم طازج يومياً.', 'Charcoal smash burgers, fresh beef daily.',
   true, extensions.st_point(46.6744, 24.7114, 4326)::extensions.geography, 'auto', null, 8, 2, 6, true, 4000, 12),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003',
   'شاورما الديرة', 'Al Deera Shawarma', 'shawarma',
   'شاورما دجاج ولحم على الطريقة الشامية.', 'Levantine-style chicken and beef shawarma.',
   true, extensions.st_point(46.7330, 24.6640, 4326)::extensions.geography, 'auto', null, 6, 3, 8, true, 5000, 10),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
   'قهوة الدرب', 'Darb Coffee', 'coffee',
   'قهوة مختصة وسعودية، ومعها حلا خفيف.', 'Specialty and Saudi coffee with light sweets.',
   true, extensions.st_point(46.6050, 24.7650, 4326)::extensions.geography, 'auto', null, 4, 2, 10, false, 3000, 0),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
   'حلا السمرة', 'Samra Sweets', 'desserts',
   'كنافة، لقيمات، وحلا الأيام الحلوة.', 'Kunafa, luqaimat and everyday sweets.',
   true, extensions.st_point(46.6420, 24.7460, 4326)::extensions.geography, 'auto', null, 7, 2, 6, true, 2500, 8),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006',
   'مندي عالماشي', 'Mandi On The Go', 'mandi',
   'مندي لحم ودجاج، مطبوخ من الفجر.', 'Lamb and chicken mandi, slow-cooked since dawn.',
   false, extensions.st_point(46.6620, 24.7560, 4326)::extensions.geography, 'auto', null, 12, 2, 5, false, 3000, 0),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000007',
   'تاكو الصحراء', 'Desert Tacos', 'tacos',
   'تاكو وبوريتو بنكهة محلية.', 'Tacos and burritos with a local twist.',
   true, extensions.st_point(46.7000, 24.7000, 4326)::extensions.geography, 'manual', 'moderate', 9, 2, 6, true, 3500, 15),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000008',
   'كبدة أبو فهد', 'Abu Fahad Liver', 'breakfast',
   'كبدة وفول وتميس للفطور.', 'Liver, foul and tamees for breakfast.',
   false, extensions.st_point(46.6900, 24.6900, 4326)::extensions.geography, 'auto', null, 8, 2, 6, false, 3000, 0);

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------
insert into public.menu_categories (id, truck_id, name_ar, name_en, sort_order) values
  ('30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'البرجر', 'Burgers', 1),
  ('30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 'الجوانب', 'Sides', 2),
  ('30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'المشروبات', 'Drinks', 3),
  ('30000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000002', 'الشاورما', 'Shawarma', 1),
  ('30000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000002', 'الوجبات', 'Meals', 2),
  ('30000000-0000-4000-8000-000000000301', '20000000-0000-4000-8000-000000000003', 'القهوة', 'Coffee', 1),
  ('30000000-0000-4000-8000-000000000302', '20000000-0000-4000-8000-000000000003', 'الحلا', 'Sweets', 2),
  ('30000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000004', 'الحلا', 'Desserts', 1),
  ('30000000-0000-4000-8000-000000000402', '20000000-0000-4000-8000-000000000004', 'المشروبات', 'Drinks', 2),
  ('30000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000005', 'المندي', 'Mandi', 1),
  ('30000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000005', 'الإضافات', 'Extras', 2),
  ('30000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000006', 'التاكو', 'Tacos', 1),
  ('30000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000006', 'البوريتو', 'Burritos', 2),
  ('30000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000007', 'الفطور', 'Breakfast', 1);

insert into public.menu_items (truck_id, category_id, name_ar, name_en, description_ar, description_en, price, prep_minutes, sort_order, is_available) values
  -- برجر الحارة
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000101', 'سماش برجر كلاسيك', 'Classic Smash', 'شريحتين لحم، جبن شيدر، صوص الحارة.', 'Two patties, cheddar, Hara sauce.', 28, 8, 1, true),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000101', 'برجر دجاج مقرمش', 'Crispy Chicken', 'صدر دجاج مقرمش مع مايونيز حار.', 'Crispy chicken breast, spicy mayo.', 25, 9, 2, true),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000101', 'برجر الحارة دبل', 'Hara Double', 'أربع شرائح لحم للجوعانين.', 'Four patties for the really hungry.', 39, 10, 3, true),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000102', 'بطاطس بالبهارات', 'Seasoned Fries', null, null, 12, 5, 1, true),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000102', 'حلقات بصل', 'Onion Rings', null, null, 14, 5, 2, false),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000103', 'ليموناضة نعناع', 'Mint Lemonade', null, null, 10, 2, 1, true),
  -- شاورما الديرة
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000201', 'شاورما دجاج صاروخ', 'Chicken Shawarma Roll', 'خبز صاج، ثوم، مخلل.', 'Saj bread, garlic, pickles.', 9, 4, 1, true),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000201', 'شاورما لحم', 'Beef Shawarma', 'طحينة وبقدونس.', 'Tahini and parsley.', 12, 4, 2, true),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000202', 'وجبة عربي دجاج', 'Arabi Chicken Meal', 'مقطعة مع بطاطس وثومية.', 'Sliced wrap with fries and garlic.', 24, 7, 1, true),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000202', 'صحن شاورما مشكل', 'Mixed Shawarma Plate', null, null, 32, 8, 2, true),
  -- قهوة الدرب
  ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000301', 'قهوة سعودية (دلة صغيرة)', 'Saudi Coffee (small dallah)', 'هيل وزعفران، مع تمر.', 'Cardamom and saffron, served with dates.', 18, 4, 1, true),
  ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000301', 'سبانيش لاتيه', 'Spanish Latte', null, null, 19, 3, 2, true),
  ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000301', 'V60 إثيوبي', 'Ethiopian V60', null, null, 22, 5, 3, true),
  ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000302', 'كوكيز بالتمر', 'Date Cookie', null, null, 9, 1, 1, true),
  -- حلا السمرة
  ('20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000401', 'كنافة بالجبن', 'Cheese Kunafa', 'تطلع حارة من الفرن.', 'Served hot from the oven.', 22, 8, 1, true),
  ('20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000401', 'لقيمات بالدبس', 'Luqaimat with Date Syrup', null, null, 15, 6, 2, true),
  ('20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000401', 'سان سباستيان', 'San Sebastian Cheesecake', null, null, 26, 2, 3, true),
  ('20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000402', 'كرك', 'Karak Tea', null, null, 6, 3, 1, true),
  -- مندي عالماشي
  ('20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000501', 'نص حبة دجاج مندي', 'Half Chicken Mandi', 'مع رز وسلطة حارة.', 'With rice and spicy salsa.', 29, 10, 1, true),
  ('20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000501', 'مندي لحم (ربع)', 'Lamb Mandi (quarter)', null, null, 55, 12, 2, true),
  ('20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000502', 'رز إضافي', 'Extra Rice', null, null, 8, 1, 1, true),
  -- تاكو الصحراء
  ('20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000601', 'تاكو دجاج', 'Chicken Taco', 'ثلاث حبات مع صوص الهالبينو.', 'Three pieces with jalapeño sauce.', 24, 7, 1, true),
  ('20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000601', 'تاكو لحم مدخن', 'Smoked Beef Taco', null, null, 29, 8, 2, true),
  ('20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000602', 'بوريتو الصحراء', 'Desert Burrito', 'رز، فاصوليا، دجاج وجبن.', 'Rice, beans, chicken and cheese.', 32, 9, 1, true),
  -- كبدة أبو فهد (pending vendor, hidden from customers)
  ('20000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000701', 'صحن كبدة', 'Liver Plate', null, null, 18, 8, 1, true),
  ('20000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000701', 'فول بالسمن', 'Foul with Ghee', null, null, 12, 5, 2, true);

-- ---------------------------------------------------------------------------
-- Active orders so the map shows all three crowd levels.
--   برجر الحارة: 10 active -> busy, شاورما الديرة: 5 -> moderate, قهوة الدرب: 1 -> empty
-- Totals are illustrative; real orders are priced server-side.
-- ---------------------------------------------------------------------------
insert into public.orders (customer_id, truck_id, type, status, subtotal, vat_amount, commission, total, pickup_slot_start, payment_status, accepted_at)
select
  '00000000-0000-4000-8000-000000000001',
  t.truck_id,
  'pickup',
  (case when g % 2 = 0 then 'accepted' else 'preparing' end)::public.order_status,
  40, 6, 4, 46,
  now() + interval '30 minutes',
  'paid',
  now() - (g || ' minutes')::interval
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid, 10),
  ('20000000-0000-4000-8000-000000000002'::uuid, 5),
  ('20000000-0000-4000-8000-000000000003'::uuid, 1)
) as t(truck_id, n)
cross join lateral generate_series(1, t.n) as g;
