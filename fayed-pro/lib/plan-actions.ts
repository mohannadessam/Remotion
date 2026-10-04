// عمليات الكتابة للخطة والفلوس المحجوزة — منفصلة عن مسارات الـ API
// عشان تنختبر مباشرة على قاعدة بيانات حقيقية. تستخدم عميل المستخدم نفسه (RLS تنطبق).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DebtStatus, Goal } from './calculator';
import {
  currentProfile, loadPlans, loadReserves, loadWindfalls, monthSources, normalizePlan, normalizeWindfall,
  PLAN_COLUMNS, WINDFALL_COLUMNS, type PlanRow, type WindfallRow,
} from './data';
import { buildMonthPlan, carryDone, lockedFrom, makeSteps, planSource, splitWindfall, withPending, type Step, type WindfallMode } from './planner';

export interface PlanInput {
  surplus: number;
  essential: number;
  emergency: number;
  debt: DebtStatus;
  goal: Goal;
  debtLeft: number | null; // الباقي من الدين (null لو ما عليه دين)
}

/** يحفظ خطة شهر بعد إعادة حسابها من الفلوس المحجوزة المخزّنة، ويطابق مساهمات الشهر مع الخطوات المؤشّرة */
export async function savePlan(supabase: SupabaseClient, userId: string, month: string, input: PlanInput): Promise<PlanRow> {
  // خطوات المبالغ اللي وصلت هالشهر وباقي ما تحوّلت تنحسب، عشان ما نحجز نفس الناقص مرتين
  const [rawReserves, windfalls] = await Promise.all([loadReserves(supabase), loadWindfalls(supabase)]);
  const reserves = withPending(rawReserves, monthSources([], windfalls, month));
  const { data: old, error: oldErr } = await supabase
    .from('plans')
    .select('steps, done')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();
  if (oldErr) throw oldErr;
  // خطوات الالتزامات اللي أشّر عليها تبقى بمبالغها: الفلوس تحوّلت فعلًا
  const locked = lockedFrom(old?.steps as Step[] | undefined, old?.done as Record<string, boolean> | undefined);
  const plan = buildMonthPlan(input, reserves, month, locked);
  const done = carryDone(old?.steps as Step[] | undefined, old?.done as Record<string, boolean> | undefined, plan.steps);

  const { data: saved, error } = await supabase
    .from('plans')
    .upsert(
      {
        user_id: userId,
        month,
        surplus: input.surplus,
        essential: input.essential,
        emergency: input.emergency,
        debt_status: input.debt,
        goal: input.goal,
        debt_left: input.debt === 'none' ? null : input.debtLeft,
        allocation: plan.allocation,
        reserved: plan.reserved,
        steps: plan.steps,
        done,
      },
      { onConflict: 'user_id,month' }
    )
    .select(PLAN_COLUMNS)
    .single();
  if (error) throw error;

  // مساهمات هذا الشهر = الخطوات المؤشّرة فقط. الخطوة اللي بقت منفذة مساهمتها موجودة من وقت
  // التأشير (toggle_plan_step)، فنحذف فقط مساهمات الخطوات اللي ما عادت منفذة.
  const source = planSource(month);
  const doneReserveSteps = plan.steps.filter((s) => s.reserveId && done[s.id]);
  let del = supabase.from('reserve_contributions').delete().eq('user_id', userId).eq('source', source);
  if (doneReserveSteps.length > 0) {
    del = del.not('reserve_id', 'in', `(${doneReserveSteps.map((s) => s.reserveId).join(',')})`);
  }
  const { error: delErr } = await del;
  if (delErr) throw delErr;

  return normalizePlan(saved);
}

export interface WindfallInput {
  id: string; // معرّف من المتصفح: نفس الطلب مرتين ما يحفظ مرتين
  month: string;
  amount: number;
  source: string;
  mode: WindfallMode;
  goal: Goal | null;
}

/**
 * يحفظ مبلغًا غير منتظم بخطواته. الخادم يحسب التوزيع بنفسه من البيانات المخزّنة
 * (آخر خطة، الفلوس المحجوزة، المبالغ السابقة). ما ينضاف شي للفلوس المحجوزة عند الحفظ —
 * فقط لما يأشّر المستخدم على الخطوة (toggle_windfall_step).
 */
export async function saveWindfall(supabase: SupabaseClient, userId: string, input: WindfallInput): Promise<WindfallRow> {
  // نفس المعرّف محفوظ من قبل؟ نرجّعه كما هو
  const { data: existing, error: exErr } = await supabase.from('windfalls').select(WINDFALL_COLUMNS).eq('id', input.id).maybeSingle();
  if (exErr) throw exErr;
  if (existing) return normalizeWindfall(existing);

  const [plans, reserves, windfalls] = await Promise.all([loadPlans(supabase), loadReserves(supabase), loadWindfalls(supabase)]);
  const last = plans[plans.length - 1] ?? null;
  if (input.mode === 'plan' && !last) throw new Error('ما فيه خطة محفوظة عشان نتبعها');

  const split = splitWindfall(input.amount, input.mode, {
    reserves: withPending(reserves, monthSources(plans, windfalls, input.month)),
    profile: currentProfile(plans, windfalls),
    plan: last,
    goal: input.goal,
  });
  const allocation = split.amounts ?? { emergency: 0, debt: 0, goal: 0, invest: 0, personal: 0 };

  const { data: saved, error } = await supabase
    .from('windfalls')
    .insert({
      id: input.id,
      user_id: userId,
      month: input.month,
      amount: input.amount,
      source: input.source,
      mode: input.mode,
      goal: input.mode === 'new' ? input.goal : null,
      allocation,
      reserved: split.reserved,
      steps: makeSteps(split.filled, split.amounts),
      done: {},
    })
    .select(WINDFALL_COLUMNS)
    .single();
  if (error) throw error;
  return normalizeWindfall(saved);
}
