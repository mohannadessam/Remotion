// Snapshots the seeded local database into src/lib/demo/fixtures.json for DEMO_MODE.
// Run after `npx supabase db reset` whenever supabase/seed.sql changes:
//   node scripts/export-demo-fixtures.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const sql = `
select json_build_object(
  'profiles', (select json_agg(p order by p.phone) from (
    select id, role, full_name, '+' || phone as phone, locale from public.profiles) p),
  'vendors', (select json_agg(v order by v.owner_id) from (
    select id, owner_id, business_name, cr_number, municipality_license_no, status, rejection_reason
    from public.vendors) v),
  'trucks', (select json_agg(t order by t.id) from (
    select id, vendor_id, name_ar, name_en, cuisine, description_ar, description_en, logo_url,
      is_suspended, is_online, lat, lng, crowd_mode, manual_crowd, crowd_status, active_orders,
      est_wait_minutes, avg_prep_minutes, parallelism, slot_capacity, delivery_enabled,
      delivery_radius_m, delivery_fee::float8 as delivery_fee, rating_avg::float8 as rating_avg, rating_count
    from public.trucks) t),
  'categories', (select json_agg(c order by c.truck_id, c.sort_order) from (
    select id, truck_id, name_ar, name_en, sort_order from public.menu_categories) c),
  'items', (select json_agg(i order by i.truck_id, i.sort_order) from (
    select id, truck_id, category_id, name_ar, name_en, description_ar, description_en,
      price::float8 as price, image_url, is_available, prep_minutes, sort_order from public.menu_items) i),
  'settings', (select row_to_json(s) from (
    select crowd_empty_max, crowd_moderate_max from public.platform_settings) s)
)`;

const out = execFileSync(
  "psql",
  ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-tAc", sql],
  { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } },
).toString();

writeFileSync("src/lib/demo/fixtures.json", JSON.stringify(JSON.parse(out), null, 2) + "\n");
console.log("wrote src/lib/demo/fixtures.json");
