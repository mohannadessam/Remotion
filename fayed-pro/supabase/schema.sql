-- فائض PRO — مخطط قاعدة البيانات (Supabase / Postgres)
-- نفّذ هذا الملف كامل في: Supabase Dashboard → SQL Editor → New query
-- آمن لإعادة التشغيل: يضيف الناقص بدون ما يمسح بيانات موجودة.

-- ============================================================
-- الجداول
-- ============================================================

-- الخطط الشهرية: لقطة لكل شهر + خطواتها وما نُفّذ منها
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1), -- أول يوم من الشهر دائمًا
  surplus numeric not null check (surplus > 0),
  essential numeric not null check (essential > 0),
  emergency numeric not null check (emergency >= 0),  -- رصيد الطوارئ أول الشهر
  debt_status text not null check (debt_status in ('none','normal','high')),
  debt_left numeric(14,2),               -- الباقي من الدين أول الشهر (فاضي = ما عليه دين أو ما انسجّل)
  goal text not null check (goal in ('safety','near','wealth','balanced')),
  allocation jsonb not null,              -- توزيع الباقي بعد الحجز: {emergency, debt, goal, invest, personal}
  created_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.plans add column if not exists reserved numeric not null default 0;  -- المحجوز للالتزامات
alter table public.plans add column if not exists steps jsonb not null default '[]';     -- [{id, text, amount, reserveId?}]
alter table public.plans add column if not exists done jsonb not null default '{}';      -- {stepId: true}
alter table public.plans add column if not exists debt_left numeric(14,2);               -- الباقي من الدين أول الشهر

-- الاشتراك (يحدّثه webhook من Lemon Squeezy)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check (status in ('active','inactive','cancelled','expired')),
  provider text not null default 'lemon_squeezy',
  provider_customer_id text,
  provider_subscription_id text,
  renewed_at timestamptz,
  ends_at timestamptz,                    -- للاشتراك الملغي: الوصول مستمر حتى هذا التاريخ
  provider_updated_at timestamptz,        -- وقت آخر حدث طُبّق (لتجاهل الأحداث المتأخرة)
  updated_at timestamptz not null default now()
);

-- الفلوس المحجوزة: التزامات سنوية تنحجز حصتها من الفائض كل شهر
create table if not exists public.reserves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount numeric not null check (amount > 0),
  due_month smallint not null check (due_month between 1 and 12),
  due_key date not null check (extract(day from due_key) = 1), -- الموعد القادم الفعلي
  initial_saved numeric not null default 0 check (initial_saved >= 0),
  created_at timestamptz not null default now()
);

-- كل مبلغ انحجز فعلًا لالتزام: من خطوة مؤشّرة في خطة شهر، أو من "وصلني مبلغ"
create table if not exists public.reserve_contributions (
  reserve_id uuid not null references public.reserves(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source ~ '^(plan:\d{4}-\d{2}-01|wf:[0-9a-f-]{36})$'),
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (reserve_id, source)
);

-- مبالغ غير منتظمة (مكافأة، جمعية...): تُحفظ بخطواتها زي الخطة الشهرية.
-- مساهماتها في الفلوس المحجوزة تنكتب في reserve_contributions بمصدر 'wf:<id>'.
create table if not exists public.windfalls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),  -- شهر استلام المبلغ
  amount numeric not null check (amount > 0),
  source text not null check (char_length(source) between 1 and 40),
  mode text not null check (mode in ('plan','new')),         -- نفس خطة الشهر | خطة جديدة
  goal text check (goal in ('safety','near','wealth','balanced')),
  allocation jsonb not null,                                  -- توزيع الباقي بعد المحجوز
  reserved numeric not null default 0,
  steps jsonb not null default '[]',
  done jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- سجل الإشعارات المرسلة — يمنع تكرار نفس البريد
create table if not exists public.notifications_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                     -- monthly_report | monthly_reminder | milestone
  ref text not null,                      -- مفتاح الشهر، أو العتبة (25/50/75/100)
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

-- تفضيلات البريد: من ضغط "إلغاء الاشتراك من الرسائل"
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unsubscribed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists plans_user_month_idx on public.plans (user_id, month desc);
create index if not exists reserves_user_idx on public.reserves (user_id);
create index if not exists contributions_user_idx on public.reserve_contributions (user_id);
create index if not exists windfalls_user_idx on public.windfalls (user_id, created_at desc);

-- ============================================================
-- الوصول
-- ============================================================

-- هل للمستخدم حق البرو الآن؟ (فعّال، أو ملغي لم تنتهِ مدته المدفوعة)
-- نفس منطق lib/subscription.ts — حافظ على تطابقهما.
create or replace function public.has_pro_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and uid = auth.uid()  -- ما يقدر أحد يستعلم عن اشتراك غيره
      and (s.status = 'active' or (s.status = 'cancelled' and s.ends_at > now()))
  );
$$;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reserves enable row level security;
alter table public.reserve_contributions enable row level security;
alter table public.windfalls enable row level security;
alter table public.notifications_sent enable row level security;
alter table public.email_prefs enable row level security;

-- القاعدة: صاحب البيانات يقرأ ويحذف دائمًا (حتى بعد انتهاء اشتراكه يشوف سجله)،
-- والإضافة والتعديل تتطلب اشتراكًا فعّالًا. هذا الحجب الحقيقي — حجب الواجهة وحده
-- يمكن تجاوزه باستدعاء Supabase مباشرة من المتصفح.

-- plans
drop policy if exists "المستخدم يشوف خططه فقط" on public.plans;
drop policy if exists "plans_select" on public.plans;
create policy "plans_select" on public.plans for select using (auth.uid() = user_id);
drop policy if exists "المستخدم يحذف خططه فقط" on public.plans;
drop policy if exists "plans_delete" on public.plans;
create policy "plans_delete" on public.plans for delete using (auth.uid() = user_id);
drop policy if exists "الإضافة للمشتركين فقط" on public.plans;
drop policy if exists "plans_insert" on public.plans;
create policy "plans_insert" on public.plans for insert
  with check (auth.uid() = user_id and public.has_pro_access(auth.uid()));
drop policy if exists "التعديل للمشتركين فقط" on public.plans;
drop policy if exists "plans_update" on public.plans;
create policy "plans_update" on public.plans for update
  using (auth.uid() = user_id and public.has_pro_access(auth.uid()))
  with check (auth.uid() = user_id and public.has_pro_access(auth.uid()));

-- subscriptions: قراءة فقط للمستخدم؛ الكتابة من الـ webhook عبر service_role
drop policy if exists "المستخدم يشوف اشتراكه فقط" on public.subscriptions;
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions for select using (auth.uid() = user_id);

-- reserves
drop policy if exists "reserves_select" on public.reserves;
create policy "reserves_select" on public.reserves for select using (auth.uid() = user_id);
drop policy if exists "reserves_delete" on public.reserves;
create policy "reserves_delete" on public.reserves for delete using (auth.uid() = user_id);
drop policy if exists "reserves_insert" on public.reserves;
create policy "reserves_insert" on public.reserves for insert
  with check (auth.uid() = user_id and public.has_pro_access(auth.uid()));
drop policy if exists "reserves_update" on public.reserves;
create policy "reserves_update" on public.reserves for update
  using (auth.uid() = user_id and public.has_pro_access(auth.uid()))
  with check (auth.uid() = user_id and public.has_pro_access(auth.uid()));

-- reserve_contributions: لازم الالتزام نفسه يكون لنفس المستخدم
drop policy if exists "contributions_select" on public.reserve_contributions;
create policy "contributions_select" on public.reserve_contributions for select using (auth.uid() = user_id);
drop policy if exists "contributions_delete" on public.reserve_contributions;
create policy "contributions_delete" on public.reserve_contributions for delete using (auth.uid() = user_id);
drop policy if exists "contributions_insert" on public.reserve_contributions;
create policy "contributions_insert" on public.reserve_contributions for insert
  with check (
    auth.uid() = user_id and public.has_pro_access(auth.uid())
    and exists (select 1 from public.reserves r where r.id = reserve_id and r.user_id = auth.uid())
  );
drop policy if exists "contributions_update" on public.reserve_contributions;
create policy "contributions_update" on public.reserve_contributions for update
  using (auth.uid() = user_id and public.has_pro_access(auth.uid()))
  with check (
    auth.uid() = user_id and public.has_pro_access(auth.uid())
    and exists (select 1 from public.reserves r where r.id = reserve_id and r.user_id = auth.uid())
  );

-- windfalls
drop policy if exists "windfalls_select" on public.windfalls;
create policy "windfalls_select" on public.windfalls for select using (auth.uid() = user_id);
drop policy if exists "windfalls_delete" on public.windfalls;
create policy "windfalls_delete" on public.windfalls for delete using (auth.uid() = user_id);
drop policy if exists "windfalls_insert" on public.windfalls;
create policy "windfalls_insert" on public.windfalls for insert
  with check (auth.uid() = user_id and public.has_pro_access(auth.uid()));
drop policy if exists "windfalls_update" on public.windfalls;
create policy "windfalls_update" on public.windfalls for update
  using (auth.uid() = user_id and public.has_pro_access(auth.uid()))
  with check (auth.uid() = user_id and public.has_pro_access(auth.uid()));

-- email_prefs: المستخدم يقرأ تفضيله؛ الكتابة من الخادم (رابط الإلغاء) عبر service_role
drop policy if exists "email_prefs_select" on public.email_prefs;
create policy "email_prefs_select" on public.email_prefs for select using (auth.uid() = user_id);

-- notifications_sent: بلا سياسات — يُكتب ويُقرأ من الخادم فقط

-- ============================================================
-- دوال (تعمل بصلاحيات المستخدم نفسه، فسياسات RLS أعلاه تنطبق عليها)
-- ============================================================

-- تأشير خطوة كمنفّذة أو إلغاؤه. خطوة "فلوس محجوزة" تضيف/تحذف المبلغ من الالتزام
-- في نفس العملية، فما يصير فرق بين الخطة والمحجوز لو انقطع الاتصال بالنص.
create or replace function public.toggle_plan_step(p_month date, p_step text, p_done boolean)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan public.plans;
  v_step jsonb;
  v_reserve uuid;
  v_source text := 'plan:' || to_char(p_month, 'YYYY-MM-DD');
  v_credit numeric;
begin
  select * into v_plan from public.plans where user_id = auth.uid() and month = p_month for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;

  select s into v_step from jsonb_array_elements(v_plan.steps) s where s->>'id' = p_step;
  if v_step is null then raise exception 'step_not_found' using errcode = 'P0002'; end if;

  update public.plans
     set done = case when p_done then done || jsonb_build_object(p_step, true) else done - p_step end
   where id = v_plan.id
  returning done into v_plan.done;

  v_reserve := nullif(v_step->>'reserveId', '')::uuid;
  if v_reserve is not null then
    if p_done then
      -- لو الالتزام انحذف بعد حفظ الخطة، ما فيه شي ينضاف له
      -- وما ينحسب أكثر من الناقص منه فعلًا: لو تغطّى من مصدر ثاني بعد الحفظ، الزايد ما ينضاف
      select least((v_step->>'amount')::numeric,
                   greatest(0, r.amount - r.initial_saved - coalesce((
                     select sum(c.amount) from public.reserve_contributions c
                      where c.reserve_id = r.id and c.source <> v_source), 0)))
        into v_credit
        from public.reserves r where r.id = v_reserve and r.user_id = auth.uid() for update;
      if found and v_credit > 0 then
        insert into public.reserve_contributions (reserve_id, user_id, source, amount)
        values (v_reserve, auth.uid(), v_source, v_credit)
        on conflict (reserve_id, source) do update set amount = excluded.amount;
      else
        delete from public.reserve_contributions where reserve_id = v_reserve and source = v_source;
      end if;
    else
      delete from public.reserve_contributions where reserve_id = v_reserve and source = v_source;
    end if;
  end if;

  return v_plan.done;
end;
$$;

-- "دفعته": الموعد ينتقل سنة، والجاهز يرجع صفر (المحجوز انصرف على الدفعة)
create or replace function public.mark_reserve_paid(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.reserves
     set due_key = (due_key + interval '12 months')::date, initial_saved = 0
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'reserve_not_found' using errcode = 'P0002'; end if;
  delete from public.reserve_contributions where reserve_id = p_id;
end;
$$;

-- تأشير خطوة في مبلغ محفوظ — نفس فكرة toggle_plan_step، والمساهمة مصدرها 'wf:<id>'
create or replace function public.toggle_windfall_step(p_id uuid, p_step text, p_done boolean)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.windfalls;
  v_step jsonb;
  v_reserve uuid;
  v_source text := 'wf:' || p_id::text;
  v_credit numeric;
begin
  select * into v_row from public.windfalls where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'windfall_not_found' using errcode = 'P0002'; end if;

  select s into v_step from jsonb_array_elements(v_row.steps) s where s->>'id' = p_step;
  if v_step is null then raise exception 'step_not_found' using errcode = 'P0002'; end if;

  update public.windfalls
     set done = case when p_done then done || jsonb_build_object(p_step, true) else done - p_step end
   where id = p_id
  returning done into v_row.done;

  v_reserve := nullif(v_step->>'reserveId', '')::uuid;
  if v_reserve is not null then
    if p_done then
      -- لو الالتزام انحذف بعد حفظ المبلغ، ما فيه شي ينضاف له
      -- وما ينحسب أكثر من الناقص منه فعلًا: لو تغطّى من مصدر ثاني بعد الحفظ، الزايد ما ينضاف
      select least((v_step->>'amount')::numeric,
                   greatest(0, r.amount - r.initial_saved - coalesce((
                     select sum(c.amount) from public.reserve_contributions c
                      where c.reserve_id = r.id and c.source <> v_source), 0)))
        into v_credit
        from public.reserves r where r.id = v_reserve and r.user_id = auth.uid() for update;
      if found and v_credit > 0 then
        insert into public.reserve_contributions (reserve_id, user_id, source, amount)
        values (v_reserve, auth.uid(), v_source, v_credit)
        on conflict (reserve_id, source) do update set amount = excluded.amount;
      else
        delete from public.reserve_contributions where reserve_id = v_reserve and source = v_source;
      end if;
    else
      delete from public.reserve_contributions where reserve_id = v_reserve and source = v_source;
    end if;
  end if;

  return v_row.done;
end;
$$;

-- حذف مبلغ محفوظ مع كل ما أضافه للفلوس المحجوزة، في عملية واحدة
create or replace function public.delete_windfall(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.windfalls where id = p_id and user_id = auth.uid();
  if not found then raise exception 'windfall_not_found' using errcode = 'P0002'; end if;
  delete from public.reserve_contributions where user_id = auth.uid() and source = 'wf:' || p_id::text;
end;
$$;

revoke all on function public.toggle_windfall_step(uuid, text, boolean) from public, anon;
revoke all on function public.delete_windfall(uuid) from public, anon;
grant execute on function public.toggle_windfall_step(uuid, text, boolean) to authenticated;
grant execute on function public.delete_windfall(uuid) to authenticated;

revoke all on function public.toggle_plan_step(date, text, boolean) from public, anon;
revoke all on function public.mark_reserve_paid(uuid) from public, anon;
grant execute on function public.toggle_plan_step(date, text, boolean) to authenticated;
grant execute on function public.mark_reserve_paid(uuid) to authenticated;
