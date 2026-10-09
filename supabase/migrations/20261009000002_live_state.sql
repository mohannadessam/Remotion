-- Live truck state: crowd status, estimated wait, online guard, nearby search, realtime.

-- Pure function so the thresholds logic can be unit-tested in SQL.
create or replace function public.crowd_level_for(active_orders integer)
returns public.crowd_level
language sql
stable
set search_path = ''
as $$
  select case
    when active_orders <= s.crowd_empty_max then 'empty'::public.crowd_level
    when active_orders <= s.crowd_moderate_max then 'moderate'::public.crowd_level
    else 'busy'::public.crowd_level
  end
  from public.platform_settings s
  where s.id
$$;

-- BEFORE trigger on trucks: derive crowd_status / est_wait_minutes, stamp location time,
-- and refuse going online unless the vendor is approved and the truck isn't suspended.
create or replace function public.trucks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.vendor_status;
begin
  if tg_op = 'INSERT' or new.location is distinct from old.location then
    new.location_updated_at = case when new.location is null then null else now() end;
  end if;

  if new.crowd_mode = 'auto' then
    new.manual_crowd = null;
  end if;

  new.crowd_status = case
    when new.crowd_mode = 'manual' then new.manual_crowd
    else public.crowd_level_for(new.active_orders)
  end;
  new.est_wait_minutes = ceil(new.active_orders * new.avg_prep_minutes::numeric / new.parallelism)::integer;

  if new.is_suspended then
    new.is_online = false;
  end if;

  if new.is_online and (tg_op = 'INSERT' or not old.is_online) then
    select v.status into v_status from public.vendors v where v.id = new.vendor_id;
    if v_status is distinct from 'approved' then
      raise exception 'vendor_not_approved' using errcode = 'P0001';
    end if;
    if new.location is null then
      raise exception 'location_required' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger trucks_before_write
before insert or update on public.trucks
for each row execute function public.trucks_before_write();

-- Recount active orders (accepted + preparing) for a truck. Updating trucks re-runs the
-- BEFORE trigger above, which recomputes crowd + wait, and Realtime broadcasts the row.
create or replace function public.refresh_truck_load(p_truck_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.trucks t
  set active_orders = c.n
  from (
    select count(*)::integer as n
    from public.orders o
    where o.truck_id = p_truck_id and o.status in ('accepted', 'preparing')
  ) c
  where t.id = p_truck_id and t.active_orders is distinct from c.n;
$$;
revoke execute on function public.refresh_truck_load(uuid) from public, anon, authenticated;

create or replace function public.orders_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_truck_load(old.truck_id);
    return old;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.truck_id is distinct from old.truck_id then
    perform public.refresh_truck_load(new.truck_id);
    if tg_op = 'UPDATE' and new.truck_id is distinct from old.truck_id then
      perform public.refresh_truck_load(old.truck_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_after_write
after insert or update or delete on public.orders
for each row execute function public.orders_after_write();

-- Changing thresholds recomputes every truck.
create or replace function public.platform_settings_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.crowd_empty_max is distinct from old.crowd_empty_max
     or new.crowd_moderate_max is distinct from old.crowd_moderate_max then
    update public.trucks set active_orders = active_orders;
  end if;
  return new;
end;
$$;

create trigger platform_settings_after_update
after update on public.platform_settings
for each row execute function public.platform_settings_after_update();

-- Nearby trucks for the map home. SECURITY INVOKER: RLS decides which trucks are visible.
create or replace function public.nearby_trucks(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 10000,
  p_only_online boolean default false
)
returns table (
  id uuid,
  name_ar text,
  name_en text,
  cuisine text,
  logo_url text,
  is_online boolean,
  lat double precision,
  lng double precision,
  distance_m double precision,
  crowd_status public.crowd_level,
  active_orders integer,
  est_wait_minutes integer,
  delivery_enabled boolean,
  delivery_radius_m integer,
  rating_avg numeric,
  rating_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    t.id, t.name_ar, t.name_en, t.cuisine, t.logo_url, t.is_online, t.lat, t.lng,
    extensions.st_distance(t.location, extensions.st_point(p_lng, p_lat, 4326)::extensions.geography) as distance_m,
    t.crowd_status, t.active_orders, t.est_wait_minutes, t.delivery_enabled, t.delivery_radius_m,
    t.rating_avg, t.rating_count
  from public.trucks t
  where t.location is not null
    and not t.is_suspended
    and (not p_only_online or t.is_online)
    and extensions.st_dwithin(
      t.location,
      extensions.st_point(p_lng, p_lat, 4326)::extensions.geography,
      least(greatest(p_radius_m, 100), 50000)
    )
  order by t.is_online desc, distance_m asc
  limit 200
$$;

-- Vendor GPS updates (every 15 s while online). RLS on trucks enforces ownership.
create or replace function public.update_truck_location(p_truck_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates' using errcode = 'P0001';
  end if;
  update public.trucks
  set location = extensions.st_point(p_lng, p_lat, 4326)::extensions.geography
  where id = p_truck_id;
  if not found then
    raise exception 'truck_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Realtime: customers subscribe to truck row changes (location, online, crowd).
alter publication supabase_realtime add table public.trucks;
