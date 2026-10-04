import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/require-pro';
import { savePlan } from '@/lib/plan-actions';
import { isMonthKey, monthDiff, monthKey } from '@/lib/month';
import type { DebtStatus, Goal } from '@/lib/calculator';

// يحفظ خطة الشهر. الخادم يعيد الحساب بنفسه من المدخلات والفلوس المحجوزة المخزّنة،
// فما نعتمد على أرقام جاية من المتصفح.

const DEBTS: DebtStatus[] = ['none', 'normal', 'high'];
const GOALS: Goal[] = ['safety', 'near', 'wealth', 'balanced'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });

  const month = b.month;
  const surplus = num(b.surplus);
  const essential = num(b.essential);
  const emergency = num(b.emergency);
  const debt = b.debt as DebtStatus;
  const goal = b.goal as Goal;
  // الباقي من الدين: مطلوب لو عليه دين
  const debtLeft = debt === 'none' ? null : num(b.debtLeft);
  if (
    !isMonthKey(month) ||
    !(surplus > 0 && surplus < 1e9) ||
    !(essential > 0 && essential < 1e9) ||
    !(emergency >= 0 && emergency < 1e10) ||
    !DEBTS.includes(debt) ||
    !GOALS.includes(goal) ||
    (debtLeft !== null && !(debtLeft >= 0 && debtLeft < 1e10))
  ) {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  // الشهر الحالي فقط (±شهر لفروق التوقيت بين المستخدم والخادم)
  if (Math.abs(monthDiff(monthKey(new Date()), month)) > 1) {
    return NextResponse.json({ error: 'تقدر تحفظ خطة الشهر الحالي فقط' }, { status: 400 });
  }

  const supabase = await createClient();
  const auth = await requirePro(supabase);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const plan = await savePlan(supabase, auth.user.id, month, { surplus, essential, emergency, debt, goal, debtLeft });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الحفظ' }, { status: 500 });
  }
}
