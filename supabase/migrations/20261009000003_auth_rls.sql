-- Auth, roles and row level security.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.owns_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.vendors v where v.id = p_vendor_id and v.owner_id = auth.uid())
$$;

create or replace function public.owns_truck(p_truck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trucks t join public.vendors v on v.id = t.vendor_id
    where t.id = p_truck_id and v.owner_id = auth.uid()
  )
$$;

-- A truck is visible to the public when its vendor is approved and it isn't suspended.
create or replace function public.truck_is_public(p_truck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trucks t join public.vendors v on v.id = t.vendor_id
    where t.id = p_truck_id and v.status = 'approved' and not t.is_suspended
  )
$$;

-- ---------------------------------------------------------------------------
-- Vendor onboarding: the only way a customer becomes a vendor.
-- ---------------------------------------------------------------------------
create or replace function public.apply_as_vendor(
  p_business_name text,
  p_cr_number text,
  p_municipality_license_no text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'admin' then
    raise exception 'admins_cannot_be_vendors' using errcode = 'P0001';
  end if;

  insert into public.vendors (owner_id, business_name, cr_number, municipality_license_no, commission_rate)
  values (
    auth.uid(),
    trim(p_business_name),
    trim(p_cr_number),
    upper(trim(p_municipality_license_no)),
    (select default_commission_rate from public.platform_settings where id)
  )
  on conflict (owner_id) do update
    set business_name = excluded.business_name,
        cr_number = excluded.cr_number,
        municipality_license_no = excluded.municipality_license_no,
        status = 'pending',
        rejection_reason = null
    where public.vendors.status in ('pending', 'rejected')
  returning id into v_id;

  if v_id is null then
    raise exception 'vendor_already_reviewed' using errcode = 'P0001';
  end if;

  update public.profiles set role = 'vendor' where id = auth.uid();
  return v_id;
end;
$$;
revoke execute on function public.apply_as_vendor(text, text, text) from public, anon;
grant execute on function public.apply_as_vendor(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Column-level privileges: clients may only write the columns they own.
-- Status, role, commission, computed crowd fields etc. are server/admin only.
-- ---------------------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

revoke insert, update on public.vendors from anon, authenticated;
grant update (business_name) on public.vendors to authenticated;

revoke insert, update on public.trucks from anon, authenticated;
grant insert (
  vendor_id, name_ar, name_en, cuisine, description_ar, description_en, logo_url,
  crowd_mode, manual_crowd, avg_prep_minutes, parallelism, slot_capacity,
  delivery_enabled, delivery_radius_m, delivery_fee
) on public.trucks to authenticated;
grant update (
  name_ar, name_en, cuisine, description_ar, description_en, logo_url,
  is_online, location, crowd_mode, manual_crowd, avg_prep_minutes, parallelism, slot_capacity,
  delivery_enabled, delivery_radius_m, delivery_fee
) on public.trucks to authenticated;

revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;

-- Orders, items and payments are written by server code (service role) in later steps.
revoke insert, update, delete on public.orders, public.order_items, public.payments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- platform_settings: readable by all (thresholds shown in UI), writable by admins only via service role.
create policy "settings readable" on public.platform_settings
  for select to anon, authenticated using (true);

-- profiles
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- vendors
create policy "vendors: read own or admin" on public.vendors
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "vendors: owner updates while unreviewed" on public.vendors
  for update to authenticated
  using (owner_id = auth.uid() and status in ('pending', 'rejected'))
  with check (owner_id = auth.uid());

-- trucks
create policy "trucks: public read approved" on public.trucks
  for select to anon, authenticated using (public.truck_is_public(id));
create policy "trucks: owner read" on public.trucks
  for select to authenticated using (public.owns_vendor(vendor_id));
create policy "trucks: admin read" on public.trucks
  for select to authenticated using (public.is_admin());
create policy "trucks: owner insert" on public.trucks
  for insert to authenticated with check (
    public.owns_vendor(vendor_id)
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.status <> 'suspended')
  );
create policy "trucks: owner update" on public.trucks
  for update to authenticated
  using (public.owns_vendor(vendor_id))
  with check (public.owns_vendor(vendor_id));
create policy "trucks: owner delete" on public.trucks
  for delete to authenticated using (public.owns_vendor(vendor_id));

-- menu_categories / menu_items: public when the truck is public; owner full access.
create policy "menu_categories: public read" on public.menu_categories
  for select to anon, authenticated using (public.truck_is_public(truck_id) or public.owns_truck(truck_id));
create policy "menu_categories: owner write" on public.menu_categories
  for all to authenticated using (public.owns_truck(truck_id)) with check (public.owns_truck(truck_id));

create policy "menu_items: public read" on public.menu_items
  for select to anon, authenticated using (public.truck_is_public(truck_id) or public.owns_truck(truck_id));
create policy "menu_items: owner write" on public.menu_items
  for all to authenticated
  using (public.owns_truck(truck_id))
  with check (
    public.owns_truck(truck_id)
    and (category_id is null or exists (
      select 1 from public.menu_categories c where c.id = category_id and c.truck_id = menu_items.truck_id
    ))
  );

-- orders: customer sees own, vendor sees their trucks', admin sees all. Writes go through server code.
create policy "orders: read" on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.owns_truck(truck_id) or public.is_admin());

create policy "order_items: read" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.customer_id = auth.uid() or public.owns_truck(o.truck_id) or public.is_admin())
  ));

-- reviews: public read; customer writes one review for their own completed order.
create policy "reviews: public read" on public.reviews
  for select to anon, authenticated using (true);
create policy "reviews: customer insert" on public.reviews
  for insert to authenticated with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid() and o.truck_id = reviews.truck_id
        and o.status = 'completed'
    )
  );

-- favorites: own rows only.
create policy "favorites: own" on public.favorites
  for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- bookings / quotes (no UI yet): customer reads own, owner of the truck reads, admin reads.
create policy "bookings: read" on public.bookings
  for select to authenticated
  using (customer_id = auth.uid() or (truck_id is not null and public.owns_truck(truck_id)) or public.is_admin());
create policy "quotes: read" on public.quotes
  for select to authenticated
  using (
    public.is_admin()
    or public.owns_vendor(vendor_id)
    or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
  );

-- payments ledger: admin only (customers see payment_status on their order).
create policy "payments: admin read" on public.payments
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: public images (folder = owner uid), private vendor documents.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images', 'menu-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('truck-logos', 'truck-logos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('vendor-docs', 'vendor-docs', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy "images: owner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('menu-images', 'truck-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_role_name() = 'vendor'
  );
create policy "images: owner update" on storage.objects
  for update to authenticated
  using (bucket_id in ('menu-images', 'truck-logos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('menu-images', 'truck-logos') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vendor-docs: owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vendor-docs: owner or admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'vendor-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
