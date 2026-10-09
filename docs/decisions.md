# Decisions log

Decisions made while building, per CLAUDE.md §12 ("decide, note it, keep going"). Newest at the bottom of each step.

## Step 1 — Scaffold, i18n/RTL, tokens, schema, seed

- **Next.js 16.4 (App Router) with `cacheComponents: false`.** The scaffold enables Cache Components by default. Our locale and session both live in cookies, so almost every route is request-time; Cache Components would require Suspense boundaries around every cookie read for no real gain. Revisit for static pages (privacy, landing) later.
- **Middleware is `src/proxy.ts`.** Next 16 renamed `middleware` to `proxy` (Node runtime). It only refreshes the Supabase session cookie.
- **i18n without locale in the URL.** `next-intl` reads the `NEXT_LOCALE` cookie (default `ar`) and `<html lang dir>` follows it. The toggle is a server action that also saves `profiles.locale`. URLs stay short and shareable across languages.
- **Latin digits in Arabic UI.** Numbers (prices, distances, minutes) use Latin digits (`ar-SA-u-nu-latn`) for consistency between server/browser ICU data and with what most Saudi apps show. Arabic-Indic numerals were optional (§9); input still accepts them (phone, CR number are normalized).
- **Font: Tajawal via `@fontsource/tajawal`.** Self-hosted from npm, so no build-time dependency on Google Fonts.
- **shadcn/ui components are hand-written in the shadcn style** (`src/components/ui`, cva + Radix via the `radix-ui` package, `components.json` present). The shadcn registry was unreachable from the build environment; the CLI can be used later with the same aliases. All controls are ≥ 44 px tall.
- **Brand tokens** are CSS variables in `globals.css` mapped to Tailwind v4 `@theme`. Crowd badges use tinted backgrounds with darker "ink" text colours, because white text on the moderate amber (`#C98A28`) fails WCAG AA.
- **Maps: MapLibre GL (open-source Mapbox GL fork) with a keyless raster basemap (OSM data via CARTO).** No Mapbox/Google key was provided. Setting `NEXT_PUBLIC_MAP_STYLE_URL` switches to any MapLibre/Mapbox-compatible style (Mapbox, MapTiler…) with no code change. For production traffic use a paid tile provider (CARTO/OSM free tiles have usage limits). Markers are DOM elements, so the map stays usable even when tiles fail to load.
- **MapLibre v6 worker** is served from `public/maplibre/` (copied by a `postinstall` script) because Next's bundler doesn't emit the separate worker module MapLibre v6 loads at runtime.
- **Schema notes.**
  - `vendor_status` adds `rejected` (admin can approve *or reject*, §4).
  - `order_status` adds `new` (paid, waiting for vendor) and `expired` (payment window passed), on top of the board states in §4.
  - `cuisine` is a fixed list (check constraint) so every value has a translation; adding one is a migration plus two i18n keys.
  - `vendors.cr_number` is unique (one CR = one vendor account).
  - `trucks.lat/lng` are generated columns from `location`, so Realtime payloads carry plain coordinates and the map can move markers without a refetch.
  - Crowd thresholds, VAT rate, default commission, max delivery radius, payment expiry and slot length live in the single-row `platform_settings` table.
  - `trucks.parallelism` (default 2) and `trucks.slot_capacity` (default 6) are per truck.
  - Order items snapshot the item name and price so history survives menu edits.
- **Crowd logic is in Postgres.** A BEFORE trigger on `trucks` derives `crowd_status` and `est_wait_minutes`. An AFTER trigger on `orders` recounts `accepted + preparing` orders and updates `trucks.active_orders`, which re-runs the BEFORE trigger. Realtime then broadcasts the truck row. Manual mode wins. `src/lib/crowd.ts` mirrors this only for unit tests and previews.
- **Seed.** 9 demo users (customer, 6 approved vendors, 1 pending vendor, admin), 7 trucks within 10 km of central Riyadh (6 publicly visible, 1 pending), bilingual menus, and active orders so the map shows busy, moderate and empty trucks. Menu photos are empty in the seed (no licensed images); the UI shows a cuisine placeholder and vendors upload real photos.

## Step 2 — Auth and roles, RLS

- **Phone OTP via Supabase Auth.** Locally, `[auth.sms.test_otp]` maps `+966500000001…20` to code `123456` and no SMS is sent. GoTrue still requires an SMS provider to be configured, so Twilio is enabled locally with dummy values; any non-test number fails locally. In production configure a real provider (e.g. Twilio, or Unifonic through the Send SMS hook) in the Supabase dashboard.
- **OTP requests and verification go through server actions** so the phone number is validated with zod server-side, and session cookies are set by `@supabase/ssr`. Saudi mobiles are normalized to E.164 (`+9665XXXXXXXX`), accepting `05…`, `5…`, `+966…`, `00966…` and Arabic-Indic digits.
- **Roles.** Everyone signs up as `customer`. The only way to become a `vendor` is the `apply_as_vendor()` SECURITY DEFINER function, which creates a `pending` vendor application. `admin` is assigned manually (seed / SQL).
- **Defence in depth.** RLS plus column-level GRANTs: clients can only write the columns they own. For example, a vendor can't write `crowd_status`, `vendors.status` or `commission_rate`, and a user can't write `profiles.role`. Orders, order items and payments get no client write grants at all; server code with the secret key writes them (steps 5–6).
- **Public visibility.** A truck (and its menu) is public only when its vendor is `approved` and the truck isn't suspended. Pending vendors can build their truck and menu, but a trigger refuses `is_online = true` until approval.
- **Anonymous browsing is allowed** for the map and truck pages (minimum data collection, faster first load). Login is required for account, vendor and (later) ordering.
- **RLS is tested** in `tests/integration/rls.test.ts` against the local stack, signing in as real demo users via OTP.

## Step 3 — Vendor: truck profile, menu CRUD, online toggle

- **One truck per vendor in the UI.** The schema allows several trucks per vendor (future fleets); the dashboard manages the first one.
- **GPS.** Going online takes a fresh fix and refuses without one. While online the page keeps a `watchPosition` and pushes the latest fix every 15 s through a server action (zod-validated, RLS-checked RPC). A screen Wake Lock is requested where supported. Background tracking with the page closed isn't possible for a PWA; the UI tells vendors to keep the page open.
- **Images** upload directly from the browser to public Storage buckets under `<user-id>/…`, as storage policies require. Server actions only accept image URLs from our own bucket and the uploader's folder. Limits are 3 MB for menu photos and 1 MB for logos, JPEG/PNG/WebP only.
- **Delivery settings** (enable, radius ≤ 5 km, fee) are already on the truck profile form; the checkout enforcement comes in step 8.

## Step 4 — Customer map home + truck page with live crowd

- **Realtime first, polling fallback.** The map subscribes to `postgres_changes` on `trucks` and patches markers from the payload. It refetches only when a truck enters or leaves the radius. While the channel isn't `SUBSCRIBED` it polls `nearby_trucks()` every 30 s. The truck page does the same for its single row.
- **Default radius 10 km** around the customer (browser geolocation), falling back to central Riyadh when location is denied. The "open now" filter shows online trucks only; offline trucks show grey otherwise.
- **Distances** come from PostGIS (`ST_Distance` on geography) in `nearby_trucks()` and are recomputed client-side (haversine) when a truck moves.
- **The add-to-cart UI is deferred to step 5** (cart + server-side pricing); the truck page shows the full menu with prices and availability now.
- **Testing note:** right after `supabase db reset`, Realtime reports `SUBSCRIBED` a few seconds before changes actually flow. The e2e tests in step 10 should wait for the first event (or retry) rather than trusting the status alone.
