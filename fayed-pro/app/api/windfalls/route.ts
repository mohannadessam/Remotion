import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/require-pro';
import { saveWindfall } from '@/lib/plan-actions';
import { isMonthKey, monthDiff, monthKey } from '@/lib/month';
import type { Goal } from '@/lib/calculator';

// يحفظ مبلغًا غير منتظم بخطواته (زي حفظ الخطة الشهرية). الخادم يحسب التوزيع بنفسه.
// المعرّف من المتصفح يمنع الحفظ مرتين لو انضغط الزر مرتين.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GOALS: Goal[] = ['safety', 'near', 'wealth', 'balanced'];

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const amount = typeof b?.amount === 'number' && Number.isFinite(b.amount) ? b.amount : NaN;
  const id = typeof b?.id === 'string' ? b.id.toLowerCase() : '';
  const source = typeof b?.source === 'string' ? b.source.trim().slice(0, 40) : '';
  const mode = b?.mode === 'plan' || b?.mode === 'new' ? b.mode : null;
  const goal = GOALS.includes(b?.goal as Goal) ? (b!.goal as Goal) : null;
  const month = b?.month;
  if (!(amount > 0 && amount < 1e10) || !UUID.test(id) || !source || !mode || !isMonthKey(month) || (mode === 'new' && b?.goal != null && !goal)) {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (Math.abs(monthDiff(monthKey(new Date()), month)) > 1) {
    return NextResponse.json({ error: 'الشهر غير صالح' }, { status: 400 });
  }

  const supabase = await createClient();
  const auth = await requirePro(supabase);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const windfall = await saveWindfall(supabase, auth.user.id, { id, month, amount, source, mode, goal });
    return NextResponse.json({ windfall });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الحفظ' }, { status: 500 });
  }
}
