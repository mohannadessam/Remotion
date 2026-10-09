-- Trukni core schema.
-- All tables: UUID PKs (except the single-row settings table), created_at/updated_at, RLS enabled.
-- Policies live in a later migration; with RLS on and no policy, a table is closed by default.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'vendor', 'admin');
create type public.vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.crowd_mode as enum ('auto', 'manual');
create type public.crowd_level as enum ('empty', 'moderate', 'busy');
create type public.order_type as enum ('pickup', 'delivery');
create type public.order_status as enum (
  'pending_payment', -- created, waiting for Moyasar confirmation
  'new',             -- paid, waiting for the vendor to accept
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'expired'          -- payment not completed within the payment window
);
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.booking_kind as enum ('corporate', 'private_event');
create type public.booking_status as enum ('requested', 'quoted', 'accepted', 'deposit_paid', 'completed', 'cancelled');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type public.payment_kind as enum ('charge', 'deposit', 'refund');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform settings (single row). Crowd thresholds etc. live here, not in code.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  crowd_empty_max integer not null default 3 check (crowd_empty_max >= 0),
  crowd_moderate_max integer not null default 8,
  default_commission_rate numeric(5, 4) not null default 0.10 check (default_commission_rate between 0 and 1),
  vat_rate numeric(5, 4) not null default 0.15 check (vat_rate between 0 and 1),
  max_delivery_radius_m integer not null default 5000 check (max_delivery_radius_m between 0 and 5000),
  payment_expiry_minutes integer not null default 15 check (payment_expiry_minutes > 0),
  pickup_slot_minutes integer not null default 15 check (pickup_slot_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (crowd_moderate_max > crowd_empty_max)
);
insert into public.platform_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text check (char_length(full_name) <= 80),
  phone text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profile creation on signup (phone OTP). Everyone starts as a customer.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, locale)
  values (
    new.id,
    new.phone,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ar' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profiles.phone in sync if the auth phone changes.
create or replace function public.handle_user_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set phone = new.phone where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_phone_changed
after update of phone on auth.users
for each row when (new.phone is distinct from old.phone)
execute function public.handle_user_phone_change();

-- ---------------------------------------------------------------------------
-- Vendors and trucks
-- ---------------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  cr_number text not null unique check (cr_number ~ '^[0-9]{10}$'),
  municipality_license_no text not null check (municipality_license_no ~ '^[A-Za-z0-9-]{4,30}$'),
  status public.vendor_status not null default 'pending',
  commission_rate numeric(5, 4) not null default 0.10 check (commission_rate between 0 and 1),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name_ar text not null check (char_length(name_ar) between 2 and 80),
  name_en text check (char_length(name_en) <= 80),
  -- keep in sync with CUISINES in src/lib/format.ts and the "cuisine" i18n keys
  cuisine text not null default 'other' check (cuisine in (
    'burgers', 'shawarma', 'coffee', 'desserts', 'mandi', 'tacos', 'breakfast', 'pizza', 'juice', 'grill', 'other'
  )),
  description_ar text check (char_length(description_ar) <= 500),
  description_en text check (char_length(description_en) <= 500),
  logo_url text,
  is_suspended boolean not null default false,
  -- live state
  is_online boolean not null default false,
  location extensions.geography(Point, 4326),
  lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  location_updated_at timestamptz,
  -- crowd: crowd_status / active_orders / est_wait_minutes are maintained by triggers
  crowd_mode public.crowd_mode not null default 'auto',
  manual_crowd public.crowd_level,
  crowd_status public.crowd_level not null default 'empty',
  active_orders integer not null default 0,
  est_wait_minutes integer not null default 0,
  avg_prep_minutes integer not null default 10 check (avg_prep_minutes between 1 and 180),
  parallelism integer not null default 2 check (parallelism between 1 and 20),
  slot_capacity integer not null default 6 check (slot_capacity between 1 and 100),
  -- delivery (fulfilled by the vendor in MVP)
  delivery_enabled boolean not null default false,
  delivery_radius_m integer not null default 3000 check (delivery_radius_m between 0 and 5000),
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  -- ratings (maintained by review trigger)
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (crowd_mode = 'auto' or manual_crowd is not null)
);
create index trucks_vendor_id_idx on public.trucks (vendor_id);
create index trucks_location_idx on public.trucks using gist (location);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks (id) on delete cascade,
  name_ar text not null check (char_length(name_ar) between 1 and 60),
  name_en text check (char_length(name_en) <= 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_categories_truck_id_idx on public.menu_categories (truck_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name_ar text not null check (char_length(name_ar) between 1 and 80),
  name_en text check (char_length(name_en) <= 80),
  description_ar text check (char_length(description_ar) <= 300),
  description_en text check (char_length(description_en) <= 300),
  price numeric(10, 2) not null check (price >= 0 and price <= 10000),
  image_url text,
  is_available boolean not null default true,
  prep_minutes integer not null default 10 check (prep_minutes between 0 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_truck_id_idx on public.menu_items (truck_id);
create index menu_items_category_id_idx on public.menu_items (category_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  truck_id uuid not null references public.trucks (id),
  type public.order_type not null,
  status public.order_status not null default 'pending_payment',
  -- money (SAR). Computed server-side; never trusted from the client.
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  vat_amount numeric(10, 2) not null default 0 check (vat_amount >= 0),
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  commission numeric(10, 2) not null default 0 check (commission >= 0),
  total numeric(10, 2) not null check (total >= 0),
  pickup_slot_start timestamptz,
  delivery_address text check (char_length(delivery_address) <= 300),
  delivery_location extensions.geography(Point, 4326),
  notes text check (char_length(notes) <= 300),
  payment_status public.payment_status not null default 'pending',
  moyasar_payment_id text unique,
  payment_expires_at timestamptz,
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type = 'pickup' or (delivery_address is not null and delivery_location is not null)),
  check (type = 'delivery' or pickup_slot_start is not null)
);
create index orders_customer_id_idx on public.orders (customer_id, created_at desc);
create index orders_truck_id_status_idx on public.orders (truck_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  -- snapshot so history survives menu edits
  name_ar text not null,
  name_en text,
  qty integer not null check (qty between 1 and 50),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  notes text check (char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items (order_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  truck_id uuid not null references public.trucks (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_truck_id_idx on public.reviews (truck_id);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  truck_id uuid not null references public.trucks (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, truck_id)
);

-- ---------------------------------------------------------------------------
-- Future-ready (Phase 2/3): tables only, no UI yet.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid references public.trucks (id) on delete set null, -- null while concierge picks a truck
  customer_id uuid not null references public.profiles (id) on delete cascade,
  kind public.booking_kind not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  guests integer check (guests > 0),
  location extensions.geography(Point, 4326),
  location_text text,
  notes text,
  status public.booking_status not null default 'requested',
  quote_amount numeric(10, 2) check (quote_amount >= 0),
  deposit_amount numeric(10, 2) check (deposit_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index bookings_truck_id_idx on public.bookings (truck_id);
create index bookings_customer_id_idx on public.bookings (customer_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete set null,
  amount numeric(10, 2) not null check (amount >= 0),
  deposit_amount numeric(10, 2) not null default 0 check (deposit_amount >= 0),
  line_items jsonb not null default '[]'::jsonb,
  valid_until date,
  status public.quote_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_booking_id_idx on public.quotes (booking_id);

-- Generic money ledger for orders and bookings (charges, deposits, refunds).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,
  kind public.payment_kind not null,
  provider text not null default 'moyasar',
  provider_payment_id text,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'SAR',
  status public.payment_status not null,
  raw jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((order_id is not null)::int + (booking_id is not null)::int = 1)
);
create index payments_order_id_idx on public.payments (order_id);
create index payments_booking_id_idx on public.payments (booking_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS on every table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'platform_settings', 'profiles', 'vendors', 'trucks', 'menu_categories', 'menu_items',
    'orders', 'order_items', 'reviews', 'favorites', 'bookings', 'quotes', 'payments'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;
