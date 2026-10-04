// تحميل البيانات من Supabase إلى أنواع lib/planner — يشتغل بعميل المتصفح أو الخادم
// (سياسات RLS تضمن إن كل مستخدم يشوف بياناته فقط).

import type { SupabaseClient } from '@supabase/supabase-js';
import { RESERVES_ENABLED } from './features';
import type { Allocation, DebtStatus, Goal } from './calculator';
import { planSource, type Profile, type Reserve, type Step, type StepSource } from './planner';

export interface PlanRow {
  month: string;
  surplus: number;
  essential: number;
  emergency: number;
  debt_status: DebtStatus;
  goal: Goal;
  debt_left: number | null; // الباقي من الدين أول الشهر (null = ما انسجّل)
  allocation: Allocation;
  reserved: number;
  steps: Step[];
  done: Record<string, boolean>;
}

export const PLAN_COLUMNS =
  'month, surplus, essential, emergency, debt_status, goal, debt_left, allocation, reserved, steps, done';

export function normalizePlan(p: Record<string, unknown>): PlanRow {
  return {
    month: String(p.month),
    surplus: Number(p.surplus),
    essential: Number(p.essential),
    emergency: Number(p.emergency),
    debt_status: p.debt_status as DebtStatus,
    goal: p.goal as Goal,
    debt_left: p.debt_left == null ? null : Number(p.debt_left),
    allocation: (p.allocation ?? {}) as Allocation,
    reserved: Number(p.reserved ?? 0),
    steps: (p.steps ?? []) as Step[],
    done: (p.done ?? {}) as Record<string, boolean>,
  };
}

export async function loadPlans(supabase: SupabaseClient): Promise<PlanRow[]> {
  const { data, error } = await supabase.from('plans').select(PLAN_COLUMNS).order('month', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizePlan);
}

export async function loadReserves(supabase: SupabaseClient): Promise<Reserve[]> {
  if (!RESERVES_ENABLED) return []; // الميزة موقوفة: كل الحسابات تمشي بدون التزامات
  const [rs, cs] = await Promise.all([
    supabase.from('reserves').select('id, name, amount, due_month, due_key, initial_saved').order('due_key'),
    supabase.from('reserve_contributions').select('reserve_id, source, amount'),
  ]);
  if (rs.error) throw rs.error;
  if (cs.error) throw cs.error;
  const byReserve: Record<string, Record<string, number>> = {};
  for (const c of cs.data ?? []) {
    (byReserve[c.reserve_id] ??= {})[c.source] = Number(c.amount);
  }
  return (rs.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    dueMonth: Number(r.due_month),
    dueKey: String(r.due_key),
    initialSaved: Number(r.initial_saved),
    contributions: byReserve[r.id] ?? {},
  }));
}

/** مبلغ غير منتظم محفوظ (مكافأة، جمعية...) مع خطواته وما نُفّذ منها */
export interface WindfallRow {
  id: string;
  month: string; // شهر استلامه "YYYY-MM-01"
  amount: number;
  source: string;
  mode: 'plan' | 'new';
  goal: Goal | null;
  allocation: Allocation;
  reserved: number;
  steps: Step[];
  done: Record<string, boolean>;
  created_at: string;
}

export const WINDFALL_COLUMNS = 'id, month, amount, source, mode, goal, allocation, reserved, steps, done, created_at';

export function normalizeWindfall(w: Record<string, unknown>): WindfallRow {
  return {
    id: String(w.id),
    month: String(w.month),
    amount: Number(w.amount),
    source: String(w.source),
    mode: w.mode === 'plan' ? 'plan' : 'new',
    goal: (w.goal ?? null) as Goal | null,
    allocation: (w.allocation ?? {}) as Allocation,
    reserved: Number(w.reserved ?? 0),
    steps: (w.steps ?? []) as Step[],
    done: (w.done ?? {}) as Record<string, boolean>,
    created_at: String(w.created_at ?? ''),
  };
}

/** الأحدث أول */
export async function loadWindfalls(supabase: SupabaseClient): Promise<WindfallRow[]> {
  const { data, error } = await supabase.from('windfalls').select(WINDFALL_COLUMNS).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeWindfall);
}

/**
 * رصيد الطوارئ بعد خطة معيّنة = رصيدها أول الشهر
 *   + حصة الطوارئ في الخطة لو أشّر إنه حوّلها
 *   + حصص الطوارئ المؤكدة من المبالغ اللي وصلته من شهر الخطة وطالع
 * `beforeMonth`: عند تعبئة خطة شهر جديد، نحسب المبالغ اللي قبل ذاك الشهر فقط
 * (مبالغ الشهر الجديد نفسه تنحسب لما ننتقل للشهر اللي بعده، فما تنعدّ مرتين).
 */
export function carriedEmergency(
  prev: PlanRow,
  windfalls: WindfallRow[] = [],
  beforeMonth?: string
): { value: number; added: number; planned: number; fromWindfalls: number } {
  const planned = prev.allocation?.emergency ?? 0;
  const added = planned > 0 && prev.done?.emergency ? planned : 0;
  const fromWindfalls = windfalls
    .filter((w) => w.month >= prev.month && (!beforeMonth || w.month < beforeMonth) && w.done?.emergency)
    .reduce((a, w) => a + (w.steps.find((s) => s.id === 'emergency')?.amount ?? 0), 0);
  return { value: prev.emergency + added + fromWindfalls, added, planned, fromWindfalls };
}

/**
 * الباقي من الدين بعد خطة معيّنة = الباقي أول الشهر
 *   − دفعة الدين في الخطة لو أشّر إنه دفعها
 *   − دفعات الدين المؤكدة من المبالغ اللي وصلته (نفس قاعدة carriedEmergency).
 * يرجّع null لو المستخدم ما سجّل دينه.
 */
export function carriedDebt(
  prev: PlanRow,
  windfalls: WindfallRow[] = [],
  beforeMonth?: string
): { value: number; paid: number } | null {
  if (prev.debt_left == null) return null;
  const fromPlan = prev.done?.debt ? (prev.allocation?.debt ?? 0) : 0;
  const fromWindfalls = windfalls
    .filter((w) => w.month >= prev.month && (!beforeMonth || w.month < beforeMonth) && w.done?.debt)
    .reduce((a, w) => a + (w.steps.find((s) => s.id === 'debt')?.amount ?? 0), 0);
  const paid = fromPlan + fromWindfalls;
  return { value: Math.max(0, Math.round((prev.debt_left - paid) * 100) / 100), paid };
}

/** وضع المستخدم الحالي من آخر خطة محفوظة (null لو ما حفظ خطة بعد) */
export function currentProfile(plans: PlanRow[], windfalls: WindfallRow[] = []): Profile | null {
  const last = plans[plans.length - 1];
  if (!last) return null;
  return {
    essential: last.essential,
    emergency: carriedEmergency(last, windfalls).value,
    debt: last.debt_status,
    goal: last.goal,
    debtLeft: carriedDebt(last, windfalls)?.value ?? null,
  };
}

/** خطوات هالشهر المحفوظة (خطة الشهر + المبالغ اللي وصلت فيه) — تُمرَّر لـ withPending */
export function monthSources(
  plans: Pick<PlanRow, 'month' | 'steps' | 'done'>[],
  windfalls: Pick<WindfallRow, 'id' | 'month' | 'steps' | 'done'>[],
  month: string
): StepSource[] {
  return [
    ...plans.filter((p) => p.month === month).map((p) => ({ source: planSource(p.month), steps: p.steps, done: p.done })),
    ...windfalls.filter((w) => w.month === month).map((w) => ({ source: `wf:${w.id}`, steps: w.steps, done: w.done })),
  ];
}
