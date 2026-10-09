# Trukni (تركني) — Food Truck Ordering Platform

> Project brief for Claude Code. Read fully before writing code. Build the MVP only (see "Scope"). Ask me only when blocked; otherwise decide, note the decision in `docs/decisions.md`, and keep going.

## 1. What we are building

A marketplace app (Uber-style, we own no trucks) connecting customers with food trucks in Saudi Arabia.

Core differentiator: **live truck location + live crowd status (empty / moderate / busy)**, order-ahead with online payment, pickup slots, and optional delivery within **5 km** of the truck.

Three business lines exist long-term, but **only line 1 is the MVP**:

1. **Instant ordering (MVP)**: discover trucks on a map, see crowd, order, pay, pickup or delivery.
2. Corporate bookings (Phase 2): book a truck for a date/location, deposit, vendor approval.
3. Private events / open buffet (Phase 3): quote requests, human concierge.

The data model must already accommodate lines 2 and 3 (see section 5) without building their UI.

## 2. Users and roles

- **Customer**: browses map, orders, pays, tracks order.
- **Vendor (truck owner)**: manages truck profile, menu, live status, incoming orders.
- **Admin**: approves vendors, views orders, handles disputes (simple internal page is enough).

Auth: phone number + OTP (Saudi numbers, +966). Vendors additionally upload commercial registration number and municipality license number; admin approves manually (no government API in MVP).

## 3. Tech stack (decided)

- Next.js (App Router) + TypeScript, built as a **PWA**, mobile-first, **RTL Arabic by default** with English toggle
- Tailwind CSS + shadcn/ui
- Supabase: Postgres + PostGIS, Auth (phone OTP), Realtime, Storage (images/docs)
- Maps: Mapbox GL (or Google Maps if key available), live markers via Supabase Realtime
- Payments: **Moyasar** (supports mada, Apple Pay, cards). Use **sandbox only** until I provide live keys
- i18n: `next-intl`, Arabic default, RTL layout
- Deploy target: Vercel + Supabase
- Tests: Vitest for logic, Playwright for the 3 critical flows

## 4. MVP scope

### Customer app
- Map home: nearby trucks (default radius 10 km), marker color = crowd status (green / amber / red), "open now" filter
- Bottom sheet list of trucks: name, cuisine, distance, crowd badge, estimated wait
- Truck page: info, live status, menu with photos, prices (SAR), add to cart
- Cart + checkout: choose **Pickup** (select a pickup slot) or **Delivery** (only if the customer address is within the truck's delivery radius, max 5 km), pay online
- Order tracking: statuses and ETA, realtime
- Order history, favorites, rating after completion

### Vendor app (web dashboard, tablet-friendly)
- Go online / offline; location updated from device GPS every 15 s while online
- Crowd mode: **Auto** (default) or manual override (empty / moderate / busy)
- Menu CRUD: categories, items, price, photo, availability toggle, prep time
- Incoming orders board: new → accepted → preparing → ready → completed / cancelled, with sound alert
- Delivery settings: enable/disable, radius (≤ 5 km), delivery fee; delivery is fulfilled by the vendor in MVP (no courier integration)
- Basic earnings summary (orders, gross, platform commission, net)

### Admin
- Approve / reject vendor applications, suspend a truck, view all orders

### Out of scope for MVP
Corporate booking UI, events/quotes UI, ZATCA e-invoice API, Balady/Wathq API integration, courier network, loyalty, chat.

## 5. Data model (Postgres)

Design all tables now, build UI only for MVP ones. Use UUID PKs, `created_at`, `updated_at`, RLS on every table.

- `profiles` (id, role, full_name, phone, locale)
- `vendors` (id, owner_id, business_name, cr_number, municipality_license_no, status[pending|approved|suspended], commission_rate)
- `trucks` (id, vendor_id, name, cuisine, logo_url, is_online, location geography(Point), crowd_mode[auto|manual], manual_crowd, delivery_enabled, delivery_radius_m (≤5000), delivery_fee, avg_prep_minutes)
- `menu_categories`, `menu_items` (truck_id, name_ar, name_en, price, image_url, is_available, prep_minutes)
- `orders` (id, customer_id, truck_id, type[pickup|delivery], status, subtotal, vat_amount, delivery_fee, commission, total, pickup_slot_start, delivery_address, delivery_location, payment_status, moyasar_payment_id)
- `order_items` (order_id, menu_item_id, qty, unit_price, notes)
- `reviews` (order_id, rating, comment)
- `favorites` (customer_id, truck_id)
- **Future-ready (create tables, no UI yet):** `bookings` (truck_id, customer_id, kind[corporate|private_event], event_date, start_time, end_time, guests, location, status[requested|quoted|accepted|deposit_paid|completed|cancelled], quote_amount, deposit_amount), `quotes`, `payments` (generic ledger for orders and bookings)

## 6. Key logic

### Live crowd status (auto mode)
`active_orders` = orders of the truck in status accepted or preparing.
- 0–3 → `empty` (green)
- 4–8 → `moderate` (amber)
- 9+ → `busy` (red)

Thresholds live in a config table, not hardcoded. Estimated wait = `active_orders * avg_prep_minutes / parallelism` (parallelism configurable per truck, default 2). Manual override wins when `crowd_mode = manual`. Recompute via Postgres trigger on order status change and broadcast over Realtime.

### Delivery eligibility
Use PostGIS `ST_DWithin(truck.location, customer_point, LEAST(truck.delivery_radius_m, 5000))`. Reject at checkout otherwise, with a clear Arabic message.

### Pickup slots
15-minute slots starting at now + estimated wait; per-slot capacity configurable per truck to prevent pile-ups.

### Payment flow (Moyasar, sandbox)
1. Create order as `pending_payment` and total computed **server-side** (never trust client prices)
2. Create Moyasar payment, redirect / embed form
3. Verify via **webhook** (signature check) and set `payment_status=paid`, then notify the vendor
4. Failed or abandoned payments expire after 15 minutes
5. Refunds: admin-triggered, logged in `payments`

Commission = `vendors.commission_rate` × subtotal (default 10%). Store VAT-related fields (`subtotal`, `vat_amount`, `total`) now so e-invoicing can be added later.

## 7. Screens (mobile-first, RTL)

Customer: Splash/Login (OTP) → Map home → Truck page → Cart → Checkout → Order tracking → History/Favorites/Profile
Vendor: Login → Dashboard (online toggle, crowd mode) → Orders board → Menu manager → Delivery settings → Earnings
Admin: Vendor approvals → Orders list

## 8. Brand tokens

- Name: **تركني** (Trukni), tagline idea: «وين التُرك؟ تركني يدلك»
- Colors: primary burnt orange `#993C1D`, secondary olive `#27500A`, trust navy `#042C53`, charcoal `#2C2C2A`, warm background `#FAF6F0`
- Crowd colors: empty `#639922`, moderate `#C98A28`, busy `#993C1D`
- Fonts: Tajawal or IBM Plex Sans Arabic (headings bold, body regular)
- Logo: circle with truck glyph and a small green "live" dot
- Tone: casual Gulf Arabic, friendly, short sentences

## 9. Non-functional requirements

- Arabic-first, full RTL, Arabic numerals optional; all copy in i18n files
- Server-side validation (zod) on every mutation; RLS policies tested
- No secrets in the repo; `.env.example` provided
- Performance: map home interactive < 3 s on 4G; image optimization
- Accessibility: tap targets ≥ 44 px, contrast AA
- PDPL-aware: collect minimum personal data, privacy policy page, delete-account flow
- Realtime must degrade gracefully (polling fallback every 30 s)

## 10. Build order (do in this order, commit after each step)

1. Project scaffold, i18n/RTL, design tokens, Supabase schema + migrations + seed data (6 fake trucks around Riyadh, with menus)
2. Auth (phone OTP) and roles, RLS policies
3. Vendor: truck profile, menu CRUD, online toggle with GPS updates
4. Customer: map home + truck page with live crowd (Realtime)
5. Cart, order creation (server-side pricing), pickup slots
6. Moyasar sandbox payment + webhook + order state machine
7. Vendor orders board with alerts, customer order tracking
8. Delivery within 5 km, reviews, favorites
9. Admin approvals, earnings summary
10. Playwright tests for: order-and-pay (pickup), order-and-pay (delivery), crowd status changes live
11. README with setup steps, `.env.example`, and a demo script

## 11. Definition of done (MVP)

- A customer can find a truck on the map, see its crowd status change live when the vendor accepts orders, order, pay in Moyasar sandbox, and track the order to completion
- A vendor can onboard, build a menu, go online, and process orders
- Delivery is blocked beyond 5 km
- All three Playwright flows pass; `npm run build` and lint are clean

## 12. Working rules for Claude Code

- Work autonomously end to end; do not stop to ask for confirmation on routine decisions
- Prefer simple, boring solutions; no speculative abstractions
- Small commits with clear messages; keep `docs/decisions.md` updated
- Never commit real keys; use sandbox keys from env vars
- If a requirement here conflicts with reality (API limits, missing keys), pick the closest workable option and record it

## 13. First prompt to paste into Claude Code

> Read CLAUDE.md. Execute build steps 1 to 4 now: scaffold the project, create the database schema and migrations with seed data, implement phone auth and roles, and the vendor menu plus the customer live map. Run the app and verify it works before reporting back.
