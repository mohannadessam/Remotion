'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALLOCATION_LABELS, calculatePlan, fmt, type Allocation, type DebtStatus, type Goal } from '@/lib/calculator';
import { ALLOCATION_HINTS, buildMonthPlan, capDebt, debtAfterText, creditFor, lockedFrom, planReason, planSource, staleSteps, whenText, withPending, type Reserve } from '@/lib/planner';
import { carriedDebt, carriedEmergency, monthSources, type PlanRow, type WindfallRow } from '@/lib/data';
import { monthKey, monthLabel } from '@/lib/month';
import ReportButton from '@/components/report-dialog';
import StepList from '@/components/step-list';
import { RESERVES_ENABLED } from '@/lib/features';

const DEBT_OPTIONS: { value: DebtStatus; label: string; hint: string }[] = [
  { value: 'high', label: 'دين عالي الأولوية', hint: 'بطاقة ائتمانية أو تمويل مرتفع التكلفة' },
  { value: 'normal', label: 'دين منخفض الأولوية', hint: 'قرض أو تمويل بقسط منتظم' },
  { value: 'none', label: 'لا يوجد دين', hint: 'ليس لدي ديون حاليًا' },
];
const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'safety', label: '🛡️ الأمان المالي' },
  { value: 'near', label: '🎯 هدف قريب' },
  { value: 'wealth', label: '📈 بناء ثروة' },
  { value: 'balanced', label: '⚖️ توازن' },
];
const MILESTONE_TEXT: Record<25 | 50 | 75 | 100, string> = {
  25: '🌱 وصلت ربع هدف صندوق الطوارئ',
  50: '🚀 وصلت نص هدف صندوق الطوارئ',
  75: '🔥 اقتربت — 75% من الهدف',
  100: '🏆 صندوق طوارئك مكتمل!',
};

// الشهر من ساعة جهاز المستخدم (مو الخادم) — يُقرأ بعد التحميل فقط لتفادي اختلاف التوقيت
const noopSubscribe = () => () => {};

type Props = { plans: PlanRow[]; reserves: Reserve[]; windfalls: WindfallRow[] };

export default function PlanClient(props: Props) {
  const month = useSyncExternalStore(noopSubscribe, () => monthKey(), () => null);
  if (!month) return <p className="text-[#737373]">…</p>;
  return <PlanForm key={month} month={month} {...props} />;
}

function PlanForm({ month, plans, reserves: rawReserves, windfalls }: Props & { month: string }) {
  const same = plans.find((p) => p.month === month) ?? null;
  const prev = [...plans].reverse().find((p) => p.month < month) ?? null;

  // التعبئة التلقائية: الشهر المحفوظ كما هو، أو من آخر خطة قبله
  const init = useMemo(() => {
    if (same) return { src: same, emergency: same.emergency, debtLeft: same.debt_left, note: `هذي خطتك المحفوظة لشهر ${monthLabel(month)}. عدّل لو تغيّر شي.` };
    if (prev) {
      // المبالغ اللي وصلته قبل هذا الشهر فقط؛ مبالغ هذا الشهر تنحسب للشهر الجاي
      const e = carriedEmergency(prev, windfalls, month);
      const parts = [fmt(prev.emergency)];
      if (e.added > 0) parts.push(`${fmt(e.added)} من خطة الشهر`);
      if (e.fromWindfalls > 0) parts.push(`${fmt(e.fromWindfalls)} من مبالغ وصلتك`);
      let note = `عبّيناها من خطة ${monthLabel(prev.month)}. `;
      if (parts.length > 1) note += `الطوارئ صارت ${fmt(e.value)} ريال (${parts.join(' + ')}). `;
      if (e.added === 0 && e.planned > 0) note += `ما أشّرت إنك حوّلت ${fmt(e.planned)} ريال للطوارئ من خطة الشهر، فما أضفناها. لو حوّلتها عدّل الرقم. `;
      // الدين: الباقي بعد الدفعات الإضافية اللي أشّر عليها
      const d = carriedDebt(prev, windfalls, month);
      if (d && d.paid > 0) note += `دينك صار ${fmt(d.value)} ريال بعد ${fmt(d.paid)} دفعتها زيادة (نقّص منه أقساطك الشهرية لو دفعتها). `;
      if (d && d.value === 0 && prev.debt_status !== 'none') note += 'دينك انسدد: غيّر وضع الديون إلى "لا يوجد دين". ';
      note += 'غيّر الفائض لو اختلف هالشهر.';
      return { src: prev, emergency: e.value, debtLeft: d?.value ?? null, note };
    }
    return null;
  }, [same, prev, month, windfalls]);

  const [surplus, setSurplus] = useState(init ? String(init.src.surplus) : '');
  const [essential, setEssential] = useState(init ? String(init.src.essential) : '');
  const [emergency, setEmergency] = useState(init ? String(init.emergency) : '');
  const [debt, setDebt] = useState<DebtStatus | null>(init?.src.debt_status ?? null);
  const [goal, setGoal] = useState<Goal | null>(init?.src.goal ?? null);
  const [debtLeft, setDebtLeft] = useState(init?.debtLeft != null ? String(init.debtLeft) : '');
  const [saved, setSaved] = useState<PlanRow | null>(same);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<25 | 50 | 75 | 100 | null>(null);
  const [note, setNote] = useState('');

  // خطوات المبالغ اللي وصلت هالشهر وباقي ما تحوّلت تنحسب، عشان ما نحجز نفس الناقص مرتين
  const reserves = useMemo(
    () => withPending(rawReserves, monthSources(saved ? [saved] : [], windfalls, month)),
    [rawReserves, saved, windfalls, month]
  );

  const hasDebt = !!debt && debt !== 'none';
  const debtOk = !hasDebt || (debtLeft !== '' && Number(debtLeft) >= 0);
  const input =
    Number(surplus) > 0 && Number(essential) > 0 && emergency !== '' && Number(emergency) >= 0 && debt && goal && debtOk
      ? { surplus: Number(surplus), essential: Number(essential), emergency: Number(emergency), debt, goal, debtLeft: hasDebt ? Number(debtLeft) : null }
      : null;
  const preview = input ? buildMonthPlan(input, reserves, month, lockedFrom(saved?.steps, saved?.done)) : null;

  const unsavedChanges =
    !!input &&
    (!saved ||
      saved.surplus !== input.surplus ||
      saved.essential !== input.essential ||
      saved.emergency !== input.emergency ||
      saved.debt_status !== input.debt ||
      saved.debt_left !== input.debtLeft ||
      saved.goal !== input.goal);

  // الخطة المحفوظة هي المرجع طول ما الأرقام ما تغيّرت: نعرضها هي، مو حسبة جديدة
  const savedView = saved && !unsavedChanges ? saved : null;
  const stale = savedView ? staleSteps(savedView.steps, savedView.done, reserves, planSource(month)) : [];
  const view = savedView
    ? (() => {
        const free = Math.max(0, Math.round((savedView.surplus - savedView.reserved) * 100) / 100);
        const calc = calculatePlan({ ...savedView, debt: savedView.debt_status, surplus: free > 0 ? free : 1 });
        return {
          reserved: savedView.reserved,
          free,
          allocation: savedView.allocation,
          reason: planReason(savedView.reserved, free, calc.reason + capDebt(calc.amounts, { debtLeft: savedView.debt_left, goal: savedView.goal }).note),
          items: savedView.steps.filter((s) => s.reserveId).map((s) => {
            const r = reserves.find((x) => x.id === s.reserveId) ?? null;
            return { id: s.reserveId!, amount: s.amount, reserve: r, name: r?.name ?? s.text.match(/"(.+)"/)?.[1] ?? 'التزام محذوف' };
          }),
        };
      })()
    : preview && {
        reserved: preview.reserved,
        free: preview.free,
        allocation: preview.allocation,
        reason: preview.reason,
        items: preview.reservedItems.filter((x) => x.take > 0).map((x) => ({ id: x.reserve.id, amount: x.take, reserve: x.reserve as Reserve | null, name: x.reserve.name })),
      };

  async function handleSave() {
    if (!input) return;
    const before = saved;
    setSaving(true);
    setError('');
    setNote('');
    try {
      const res = await fetch('/api/plans/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, ...input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save');
      setSaved(data.plan);
      const next = data.plan as PlanRow;
      const reset = before ? before.steps.filter((s) => before.done[s.id] && !next.done[s.id]).length : 0;
      if (reset > 0) setNote('تغيّر مبلغ خطوة كنت مأشّر عليها، فرجعت غير منفذة. حوّل الفرق وأشّر عليها من جديد.');
      // الاستمرارية وبريد التهنئة — اختياري، ما يوقف الحفظ لو فشل
      fetch('/api/plans/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((n) => { if (n) { setStreak(n.streak ?? null); setMilestone(n.milestone ?? null); } })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error && e.message !== 'save' ? e.message : 'تعذّر الحفظ، حاول مرة ثانية.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(stepId: string, checked: boolean) {
    if (!saved) return;
    const before = saved;
    const done = { ...saved.done };
    if (checked) done[stepId] = true; else delete done[stepId];
    setSaved({ ...saved, done }); // تحديث فوري، ونرجع لو فشل
    setNote('');
    const step = saved.steps.find((s) => s.id === stepId);
    const credit = checked && step ? creditFor(step, reserves, planSource(month)) : null;
    const { data, error: rpcError } = await createClient().rpc('toggle_plan_step', {
      p_month: month, p_step: stepId, p_done: checked,
    });
    if (rpcError) {
      setSaved(before);
      setError('تعذّر حفظ التأشير، حاول مرة ثانية.');
    } else {
      setSaved((s) => (s ? { ...s, done: (data as Record<string, boolean>) ?? done } : s));
      if (step && credit !== null && credit < step.amount) {
        setNote(
          credit > 0
            ? `هذا الالتزام ناقصه ${fmt(credit)} ريال فقط، فاحتسبنا له ${fmt(credit)}. الباقي (${fmt(step.amount - credit)} ريال) حر لك.`
            : 'هذا الالتزام مكتمل أو انحذف، فما انضاف له شي. المبلغ حر لك.'
        );
      }
    }
  }

  const doneN = saved ? saved.steps.filter((s) => saved.done[s.id]).length : 0;

  return (
    <div className="space-y-6">
      {plans.length === 0 && !saved && <Welcome hasReserves={reserves.length > 0} />}

      <div>
        <h1 className="text-3xl font-extrabold mb-1">خطة {monthLabel(month)}</h1>
        <p className="text-[#737373]">{RESERVES_ENABLED ? 'وش تسوي بفائض هالشهر؟ الفلوس المحجوزة تنحجز أول، وبعدين نوزّع الباقي.' : 'وش تسوي بفائض هالشهر؟ نوزّعه حسب وضعك، وتنفّذه خطوة خطوة.'}</p>
      </div>

      {init && <p className="text-sm leading-7 bg-[#dfece7] rounded-xl p-4">{init.note}</p>}

      <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-5">
        <Field id="surplus" label="الفائض هذا الشهر" value={surplus} onChange={setSurplus} placeholder="3000"
          hint={RESERVES_ENABLED ? undefined : 'اللي يبقى من دخلك بعد كل مصاريف الشهر.'} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Field id="essential" label="احتياجك الأساسي شهريًا لو انقطع الدخل" value={essential} onChange={setEssential} placeholder="4000"
              hint={RESERVES_ENABLED
                ? 'اللي تدفعه كل شهر فقط: أكل، فواتير، مواصلات، أقساط شهرية، وإيجارك لو تدفعه شهري. نحسب منه هدف الطوارئ (6 أشهر). أي مصروف تدفعه مرة بالسنة (إيجار سنوي، مدارس، تأمين) لا تحسبه هنا، مكانه فلوس محجوزة.'
                : 'مجموع مصاريفك الأساسية في الشهر. مثال: سكن 1,500 + أكل 1,200 + فواتير 500 + مواصلات 400 + أقساط 400 = 4,000 ريال.'} />
            {rawReserves.length > 0 && (
              <p className="text-xs text-[#805b20] leading-6 mt-1">
                مسجّل عندك في فلوس محجوزة: {rawReserves.map((r) => r.name).join('، ')}. لا تحسبها في هذا الرقم.
              </p>
            )}
          </div>
          <Field id="emergency" label="احتياطي الطوارئ الحالي" value={emergency} onChange={setEmergency} placeholder="6000" />
        </div>
        <fieldset>
          <legend className="block text-sm font-bold mb-2">وضع الديون</legend>
          <div className="grid gap-2">
            {DEBT_OPTIONS.map((o) => (
              <Choice key={o.value} selected={debt === o.value} onClick={() => setDebt(o.value)}>
                <strong className="block text-sm">{o.label}</strong>
                <small className="text-[#737373]">{o.hint}</small>
              </Choice>
            ))}
          </div>
          <p className="text-xs text-[#737373] leading-6 mt-2">
            الدين = مبلغ اقترضته وترجّعه (قرض، بطاقة ائتمانية، تمويل سيارة).{' '}
            {RESERVES_ENABLED ? (
              <>غير الالتزامات السنوية مثل الإيجار والمدارس: هذي مصاريف قادمة مكانها <Link href="/app/reserves" className="underline">فلوس محجوزة</Link>.</>
            ) : (
              'الإيجار والمدارس والفواتير مو ديون: هذي مصاريف مكانها احتياجك الأساسي فوق.'
            )}
          </p>
        </fieldset>
        {hasDebt && (
          <div>
            <Field id="debtLeft" label="كم باقي من دينك؟ (الإجمالي، مو القسط الشهري)" value={debtLeft} onChange={setDebtLeft} placeholder="40000" />
            <p className="text-xs text-[#737373] leading-6 mt-2">إجمالي اللي باقي عليك لين يخلص الدين: رقم واحد ينقص مع السداد. مثال: قسطك 1,500 بالشهر وباقي 20 قسط، تكتب 30,000. القسط نفسه (1,500) مكانه في احتياجك الأساسي فوق، مو هنا.</p>
          </div>
        )}
        <fieldset>
          <legend className="block text-sm font-bold mb-2">الهدف الأساسي</legend>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((o) => (
              <Choice key={o.value} selected={goal === o.value} onClick={() => setGoal(o.value)}>{o.label}</Choice>
            ))}
          </div>
        </fieldset>
      </div>

      {preview && (
        <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-extrabold">{preview.calc.statusLabel}</h2>
            <span className="text-xs font-bold bg-[#fff2df] text-[#805b20] rounded-full px-3 py-1.5">
              الطوارئ تغطي {preview.calc.coveredMonths} شهر
            </span>
          </div>

          <div className="bg-[#fbfaf7] border border-[#e8e6df] rounded-2xl p-4">
            <div className="flex justify-between text-sm text-[#737373] mb-2">
              <span>التقدم نحو هدف 6 أشهر طوارئ</span>
              <span>{Math.round(preview.calc.emergencyProgress)}%</span>
            </div>
            <div className="h-2.5 bg-[#eee] rounded-full overflow-hidden">
              <div className="h-full bg-[#173f35] rounded-full" style={{ width: `${Math.min(100, preview.calc.emergencyProgress)}%` }} />
            </div>
          </div>

          {!savedView && preview.shortfall > 0 && (
            <p className="text-sm leading-7 bg-[#fbe9e7] text-[#9d3b35] rounded-xl p-3">
              فائضك ما يكفي كل الالتزامات القادمة. ناقصك {fmt(preview.shortfall)} ريال هالشهر، فحجزنا للأقرب موعدًا أول.{' '}
              <Link href="/app/windfall" className="underline font-bold">وصلك مبلغ إضافي؟</Link>
            </p>
          )}

          {stale.length > 0 && (
            <div className="text-sm leading-7 bg-[#fff2df] text-[#805b20] rounded-xl p-3 space-y-2">
              <p>التزاماتك تغيّرت بعد حفظ الخطة (تعدّلت أو تغطّت من مبلغ وصلك)، فبعض الخطوات تحت ما عادت دقيقة.</p>
              <button onClick={handleSave} disabled={saving} className="w-full bg-[#173f35] text-white rounded-xl py-2.5 font-bold disabled:opacity-60">
                {saving ? 'جاري التحديث...' : 'حدّث الخطة'}
              </button>
            </div>
          )}

          {view && view.reserved > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#737373]">محجوز أولًا · {fmt(view.reserved)} ريال</div>
              {view.items.map((x) => {
                const overdue = !!x.reserve && whenText(x.reserve, month).startsWith('فات');
                return (
                  <div key={x.id} className="bg-[#f5ecdc] rounded-xl p-3 flex justify-between gap-3 text-sm">
                    <span>
                      📌 {x.name}
                      {x.reserve && (
                        <small className={`block text-xs ${overdue ? 'text-[#9d3b35]' : 'text-[#737373]'}`}>
                          {monthLabel(x.reserve.dueKey)} · {whenText(x.reserve, month)}
                        </small>
                      )}
                    </span>
                    <span className="font-bold whitespace-nowrap">{fmt(x.amount)} ريال</span>
                  </div>
                );
              })}
            </div>
          )}

          {view && view.free > 0 && (
            <div className="space-y-2">
              {view.reserved > 0 && <div className="text-xs font-bold text-[#737373]">توزيع الباقي · {fmt(view.free)} ريال</div>}
              {(['emergency', 'debt', 'goal', 'invest', 'personal'] as (keyof Allocation)[])
                .filter((k) => view.allocation[k] > 0)
                .map((k) => (
                  <div key={k} className="border border-[#e8e6df] rounded-xl p-3 flex justify-between gap-3 text-sm">
                    <span>
                      <span className="font-bold">{ALLOCATION_LABELS[k]}</span>
                      <small className="block text-xs text-[#737373] mt-0.5 leading-5">
                        {(k === 'debt' && debtAfterText(input!.debtLeft, view.allocation.debt)) || ALLOCATION_HINTS[k]}
                      </small>
                    </span>
                    <span className="whitespace-nowrap font-bold">{fmt(view.allocation[k])} ريال</span>
                  </div>
                ))}
            </div>
          )}

          <p className="text-sm leading-7 bg-[#f3f0e8] rounded-xl p-4">{view?.reason ?? preview.reason}</p>

          {(unsavedChanges || !saved) && (
            <button onClick={handleSave} disabled={saving} className="w-full bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-60">
              {saving ? 'جاري الحفظ...' : saved ? 'حدّث الخطة المحفوظة' : 'احفظ الخطة وابدأ التنفيذ'}
            </button>
          )}
          {saved && unsavedChanges && (
            <p className="text-xs text-[#805b20] text-center">غيّرت أرقام الخطة. احفظ عشان تتحدث الخطوات تحت.</p>
          )}
          {error && <p className="text-sm text-[#9d3b35] text-center">{error}</p>}

          {(milestone || (streak !== null && streak >= 2)) && (
            <div className="space-y-2">
              {milestone && <div className="bg-[#dfece7] text-[#173f35] rounded-xl p-3 text-sm text-center font-bold">{MILESTONE_TEXT[milestone]}</div>}
              {streak !== null && streak >= 2 && (
                <div className="bg-[#fff2df] text-[#805b20] rounded-xl p-3 text-sm text-center font-bold">🔥 {streak} أشهر متتالية تسجّل خطتك</div>
              )}
            </div>
          )}
        </div>
      )}

      {saved && saved.steps.length > 0 && (
        <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-extrabold">خطوات {monthLabel(month)}</h2>
            <span className="text-xs text-[#737373]">نفّذت {doneN} من {saved.steps.length}</span>
          </div>
          <StepList steps={saved.steps} done={saved.done} onToggle={toggle} />
          {note && <p className="text-sm leading-7 bg-[#fff2df] text-[#805b20] rounded-xl p-3">{note}</p>}
          <p className="text-xs text-[#737373] leading-6">
            {saved.allocation.personal > 0 && <>❤️ و{fmt(saved.allocation.personal)} ريال لك، اصرفها براحتك. </>}
            أشّر على كل خطوة بعد ما تنفذها فعلًا، عشان تنحسب في {RESERVES_ENABLED ? 'فلوسك المحجوزة وفي الطوارئ' : 'الطوارئ والدين'} الشهر الجاي.
          </p>
          <ReportButton month={month} />
        </div>
      )}
    </div>
  );
}

function Welcome({ hasReserves }: { hasReserves: boolean }) {
  return (
    <div className="bg-[#173f35] text-white rounded-3xl p-6 space-y-3">
      <h2 className="text-xl font-extrabold">أهلًا في فائض PRO 👋</h2>
      <p className="text-sm leading-7 opacity-90">كل شهر نجاوب على سؤال واحد: وش تسوي بالفلوس اللي بقت؟</p>
      <ol className="text-sm leading-7 space-y-1 list-decimal pr-5 opacity-90">
        {RESERVES_ENABLED && <li>
          {hasReserves ? 'أضفت فلوسك المحجوزة ✓' : (
            <>عندك مصاريف سنوية (إيجار، مدارس، رمضان)؟ <Link href="/app/reserves" className="underline font-bold">أضفها أول</Link> عشان نحجز لها.</>
          )}
        </li>}
        <li>عبّي أرقام هالشهر تحت، واحفظ الخطة.</li>
        <li>نفّذ الخطوات وأشّر عليها. الشهر الجاي نعبّي لك كل شي تلقائيًا.</li>
      </ol>
    </div>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`text-right border rounded-xl px-4 py-3 transition ${selected ? 'border-[#173f35] bg-[#dfece7]' : 'border-[#e8e6df] bg-white hover:border-[#b7c8c1]'}`}
    >
      {children}
    </button>
  );
}

function Field({ id, label, value, onChange, placeholder, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold mb-2">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 text-center text-lg font-bold outline-none focus:border-[#173f35]"
        dir="ltr"
      />
      {hint && <p className="text-xs text-[#737373] leading-6 mt-2">{hint}</p>}
    </div>
  );
}
