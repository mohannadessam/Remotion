# تركني · Trukni

Food-truck marketplace for Saudi Arabia: live truck locations, live crowd status, order-ahead.
See [`CLAUDE.md`](./CLAUDE.md) for the product brief and [`docs/decisions.md`](./docs/decisions.md) for decisions taken while building.

**Status:** build steps 1–4 are done (scaffold + schema + seed, phone OTP auth + RLS, vendor truck/menu/online, customer live map + truck page). Ordering and payments come next. A full README with a demo script is step 11.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind v4 + shadcn-style UI · next-intl (Arabic/RTL by default) · Supabase (Postgres + PostGIS, Auth phone OTP, Realtime, Storage) · MapLibre GL · Vitest · Playwright

## Quick demo (no keys, no Supabase)

```bash
npm install
DEMO_MODE=true npm run dev    # http://localhost:3000, sign in with any number below, code 123456
```

Serves the seeded trucks, menus and crowd states from local fixtures, with a static map when no Mapbox token is set. See "Demo mode" in [`docs/decisions.md`](./docs/decisions.md) for what is and isn't saved.

| | Arabic (default) | English |
| --- | --- | --- |
| Login | [ar-1-login](docs/screens/ar-1-login.png) | [en-1-login](docs/screens/en-1-login.png) |
| Map + truck list | [ar-2-map](docs/screens/ar-2-map.png) | [en-2-map](docs/screens/en-2-map.png) |
| Truck page + menu | [ar-3-truck](docs/screens/ar-3-truck.png) | [en-3-truck](docs/screens/en-3-truck.png) |
| Vendor dashboard | [ar-4-vendor-dashboard](docs/screens/ar-4-vendor-dashboard.png) | [en-4-vendor-dashboard](docs/screens/en-4-vendor-dashboard.png) |

Regenerate with `npm run screens` while the app is running.

## Run locally with Supabase

Requires Node 22+ and Docker.

```bash
npm install
npx supabase start            # local Postgres/Auth/Realtime/Storage (first run pulls images)
npx supabase db reset         # applies migrations + supabase/seed.sql
cp .env.example .env.local    # then fill the keys from `npx supabase status`
npm run dev                   # http://localhost:3000
```

Demo logins (local only, OTP is always `123456`):

| Phone | Role |
| --- | --- |
| 0500000001 | Customer |
| 0500000002 – 0500000007 | Approved vendors (one truck each) |
| 0500000008 | Vendor with a pending application |
| 0500000009 | Admin |
| 0500000010 – 0500000020 | Unused, try signing up |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests + RLS integration tests (needs the local Supabase stack) |
| `npm run test:unit` | Unit tests only |
| `npm run db:reset` | Re-apply migrations and seed |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |
| `npm run demo:fixtures` | Re-export `src/lib/demo/fixtures.json` from the seeded local DB |
| `npm run screens` | Capture `docs/screens/*.png` from a running app |

## Layout

```
supabase/migrations/   schema, crowd/live-state logic, auth + RLS + storage
supabase/seed.sql      demo users, 7 trucks around Riyadh, menus, active orders
src/app/(main)/        customer: map home, truck page, account
src/app/vendor/        vendor: onboarding, dashboard (online/GPS, crowd), truck profile, menu
src/app/login/         phone OTP
src/lib/               supabase clients, auth (DAL), zod schemas, phone/geo/crowd helpers
src/lib/demo/          DEMO_MODE fixtures + in-memory store
messages/              ar.json (default) / en.json
tests/                 unit + RLS integration tests
```
