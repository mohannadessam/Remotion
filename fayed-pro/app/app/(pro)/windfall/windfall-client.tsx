'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALLOCATION_LABELS, fmt, type Allocation, type Goal } from '@/lib/calculator';
import { ALLOCATION_HINTS, creditFor, debtAfterText, makeSteps, splitWindfall, withPending, type Reserve, type WindfallMode } from '@/lib/planner';
import { currentProfile, loadReserves, monthSources, type PlanRow, type WindfallRow } from '@/lib/data';
import { monthKey, monthLabel } from '@/lib/month';
import StepList from '@/components/step-list';
import { RESERVES_ENABLED } from '@/lib/features';
import ReportButton from '@/components/report-dialog';

const SOURCES = ['مكافأة', 'جمعية', 'نهاية خدمة', 'بيع', 'غير ذلك'];
const GOALS: { value: Goal; label: string }[] = [
  { value: 'safety', label: '🛡️ الأمان المالي' },
  { value: 'near', label: '🎯 هدف قريب' },
  { value: 'wealth', label: '📈 بناء ثروة' },
  { value: 'balanced', label: '⚖️ توازن' },
];
const noopSubscribe = () => () => {};

export default function WindfallClient({ plans, reserves: initialReserves, windfalls: initialWindfalls }: {
  plans: PlanRow[];
  reserves: Reserve[];
  windfalls: WindfallRow[];
}) {
  const month = useSyncExternalStore(noopSubscribe, () => monthKey(), () => null);
  const [rawReserves, setReserves] = useState(initialReserves);
  const [windfalls, setWindfalls] = useState(initialWindfalls);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  // اللي محجوز في خطة الشهر أو في مبلغ سابق وباقي ما تحوّل ينحسب، عشان ما نحجزه مرتين
  const reserves = useMemo(
    () => (month ? withPending(rawReserves, monthSources(plans, windfalls, month)) : rawReserves),
    [rawReserves, plans, windfalls, month]
  );
  const plan = plans[plans.length - 1] ?? null;
  // وضع المستخدم يتحدث مع كل خطوة طوارئ يأشّرها
  const profile = currentProfile(plans, windfalls);

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [modeChoice, setModeChoice] = useState<WindfallMode | null>(null);
  const [goalChoice, setGoalChoice] = useState<Goal | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // الافتراضي "نفس خطة الشهر" متى ما وُجدت خطة، إلا لو اختار المستخدم بنفسه
  const canFollowPlan = !!plan && !!profile;
  const mode: WindfallMode = modeChoice === 'plan' && !canFollowPlan ? 'new' : modeChoice ?? (canFollowPlan ? 'plan' : 'new');
  const goal: Goal = goalChoice ?? profile?.goal ?? 'balanced';

  const amt = Number(amount);
  const split = amt > 0 ? splitWindfall(amt, mode, { reserves, profile, plan, goal }) : null;
  const previewSteps = split ? makeSteps(split.filled, split.amounts) : [];

  // أي تغيير في المدخلات = حفظ جديد
  const touch = () => { setRequestId(null); setError(''); setJustSaved(null); };

  async function save() {
    if (!split || !month || previewSteps.length === 0) return;
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/windfalls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, month, amount: amt, source, mode, goal: mode === 'new' ? goal : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save');
      setWindfalls((list) => [data.windfall, ...list.filter((w) => w.id !== data.windfall.id)]);
      setJustSaved(data.windfall.id);
      setAmount('');
      setRequestId(null);
    } catch (e) {
      setError(e instanceof Error && e.message !== 'save' ? e.message : 'تعذّر الحفظ، حاول مرة ثانية.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, stepId: string, checked: boolean) {
    const before = windfalls;
    setNote(null);
    const step = before.find((w) => w.id === id)?.steps.find((x) => x.id === stepId);
    const credit = checked && step ? creditFor(step, rawReserves, `wf:${id}`) : null;
    setWindfalls((list) => list.map((w) => {
      if (w.id !== id) return w;
      const done = { ...w.done };
      if (checked) done[stepId] = true; else delete done[stepId];
      return { ...w, done };
    }));
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('toggle_windfall_step', { p_id: id, p_step: stepId, p_done: checked });
    if (rpcError) {
      setWindfalls(before);
      setError('تعذّر حفظ التأشير، حاول مرة ثانية.');
      return;
    }
    setWindfalls((list) => list.map((w) => (w.id === id ? { ...w, done: (data as Record<string, boolean>) ?? w.done } : w)));
    if (stepId.startsWith('res:')) setReserves(await loadReserves(supabase)); // المحجوز تغيّر
    if (step && credit !== null && credit < step.amount) {
      setNote({
        id,
        text: credit > 0
          ? `هذا الالتزام ناقصه ${fmt(credit)} ريال فقط، فاحتسبنا له ${fmt(credit)}. الباقي (${fmt(step.amount - credit)} ريال) حر لك.`
          : 'هذا الالتزام مكتمل أو انحذف، فما انضاف له شي. المبلغ حر لك.',
      });
    }
  }

  async function remove(id: string) {
    setConfirmDelete(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('delete_windfall', { p_id: id });
    if (rpcError) { setError('تعذّر الحذف، حاول مرة ثانية.'); return; }
    setWindfalls((list) => list.filter((w) => w.id !== id));
    setReserves(await loadReserves(supabase));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold mb-1">وصلني مبلغ</h1>
        <p className="text-[#737373] leading-7">مكافأة، جمعية، نهاية خدمة، بيع شي. اختر كيف توزّعه، واحفظه عشان تتابع تنفيذه.</p>
      </div>

      <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-4">
        <div>
          <label htmlFor="wfAmount" className="block text-sm font-bold mb-2">المبلغ</label>
          <input id="wfAmount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => { setAmount(e.target.value); touch(); }} placeholder="15000" dir="ltr" className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 text-center text-lg font-bold outline-none focus:border-[#173f35]" />
        </div>
        <div>
          <label htmlFor="wfSource" className="block text-sm font-bold mb-2">مصدره</label>
          <select id="wfSource" value={source} onChange={(e) => { setSource(e.target.value); touch(); }} className="w-full border border-[#e8e6df] rounded-xl px-3 py-3 bg-white outline-none focus:border-[#173f35]">
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="block text-sm font-bold mb-2">كيف نوزّعه؟</legend>
          <div className="grid gap-2">
            <ModeChoice selected={mode === 'plan'} disabled={!canFollowPlan} onClick={() => { setModeChoice('plan'); touch(); }}
              title="نفس خطة الشهر"
              hint={plan ? `كل بند ياخذ نفس نسبته في خطة ${monthLabel(plan.month)}` : 'احفظ خطة شهر أول عشان يتفعّل هذا الخيار'} />
            <ModeChoice selected={mode === 'new'} onClick={() => { setModeChoice('new'); touch(); }}
              title="خطة جديدة لهذا المبلغ"
              hint={RESERVES_ENABLED ? 'نسد الفلوس المحجوزة الناقصة كاملة أول، والباقي حسب هدف تختاره' : 'توزيع جديد حسب وضعك الحالي وهدف تختاره لهذا المبلغ'} />
          </div>
        </fieldset>

        {mode === 'new' && profile && (
          <fieldset>
            <legend className="block text-sm font-bold mb-2">هدف هذا المبلغ</legend>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button key={g.value} type="button" aria-pressed={goal === g.value} onClick={() => { setGoalChoice(g.value); touch(); }}
                  className={`text-right border rounded-xl px-4 py-3 text-sm transition ${goal === g.value ? 'border-[#173f35] bg-[#dfece7]' : 'border-[#e8e6df] bg-white hover:border-[#b7c8c1]'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {profile && (
          <p className="text-xs text-[#737373] leading-6">
            نستخدم وضعك من آخر خطة: طوارئ {fmt(profile.emergency)} ريال
            {profile.debt !== 'none' && profile.debtLeft != null && <>، وباقي من دينك {fmt(profile.debtLeft)} ريال</>}
            {profile.debt !== 'none' && profile.debtLeft == null && <>. ما سجّلت كم باقي من دينك: <Link href="/app/plan" className="underline">أضفه في الخطة</Link> عشان حصة السداد ما تتجاوزه</>}.
          </p>
        )}

        {!profile && (
          <p className="text-xs text-[#737373] leading-6">
            عشان نوزّع الباقي حسب وضعك، <Link href="/app/plan" className="underline">احفظ خطة شهر</Link> أول.{RESERVES_ENABLED && ' سد الفلوس المحجوزة يشتغل بدونها.'}
          </p>
        )}
      </div>

      {split && (
        <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-3">
          {split.filled.length > 0 && (
            <>
              <div className="text-xs font-bold text-[#737373]">للفلوس المحجوزة · {fmt(split.reserved)} ريال</div>
              {split.filled.map((x) => (
                <div key={x.reserve.id} className="bg-[#f5ecdc] rounded-xl p-3 flex justify-between gap-3 text-sm">
                  <span>
                    📌 {x.reserve.name}
                    <small className="block text-xs text-[#737373]">{x.take >= x.gap ? 'يكتمل بالكامل ✓' : `يبقى ${fmt(x.gap - x.take)} ريال`}</small>
                  </span>
                  <span className="font-bold whitespace-nowrap">{fmt(x.take)} ريال</span>
                </div>
              ))}
            </>
          )}

          {split.free > 0 && (
            <>
              {split.filled.length > 0 && <div className="text-xs font-bold text-[#737373] pt-2">الباقي · {fmt(split.free)} ريال</div>}
              {split.amounts ? (
                (['emergency', 'debt', 'goal', 'invest', 'personal'] as (keyof Allocation)[])
                  .filter((k) => split.amounts![k] > 0)
                  .map((k) => (
                    <div key={k} className="border border-[#e8e6df] rounded-xl p-3 flex justify-between gap-3 text-sm">
                      <span>
                        <span className="font-bold">{ALLOCATION_LABELS[k]}</span>
                        <small className="block text-xs text-[#737373] mt-0.5 leading-5">
                          {(k === 'debt' && debtAfterText(profile?.debtLeft, split.amounts!.debt)) || ALLOCATION_HINTS[k]}
                        </small>
                      </span>
                      <span className="whitespace-nowrap font-bold">{fmt(split.amounts![k])} ريال</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-[#737373]">باقي {fmt(split.free)} ريال. احفظ خطة شهر عشان نقترح توزيعها.</p>
              )}
            </>
          )}

          <p className="text-sm leading-7 bg-[#f3f0e8] rounded-xl p-4">{split.reason}</p>

          {previewSteps.length > 0 ? (
            <button onClick={save} disabled={saving || !month} className="w-full bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-60">
              {saving ? 'جاري الحفظ...' : 'احفظ الخطة وابدأ التنفيذ'}
            </button>
          ) : (
            <p className="text-xs text-[#737373] text-center">ما فيه خطوات تنحفظ. احفظ خطة شهر أول عشان نقترح توزيع المبلغ.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-[#9d3b35] text-center">{error}</p>}

      {windfalls.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-extrabold">مبالغك المحفوظة</h2>
          {windfalls.map((w) => {
            const doneN = w.steps.filter((s) => w.done[s.id]).length;
            const complete = w.steps.length > 0 && doneN === w.steps.length;
            return (
              <details key={w.id} open={w.id === justSaved || !complete} className="bg-white border border-[#e8e6df] rounded-3xl p-5">
                <summary className="cursor-pointer flex items-center justify-between gap-3">
                  <span>
                    <strong>{w.source} · {fmt(w.amount)} ريال</strong>
                    <small className="block text-xs text-[#737373] mt-0.5">
                      {monthLabel(w.month)} · {w.mode === 'plan' ? 'نفس خطة الشهر' : 'خطة جديدة'}
                    </small>
                  </span>
                  <span className={`text-xs whitespace-nowrap ${complete ? 'text-[#173f35] font-bold' : 'text-[#737373]'}`}>
                    نفّذت {doneN} من {w.steps.length}{complete ? ' ✓' : ''}
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  {w.id === justSaved && <p className="text-sm text-[#173f35] font-bold">✓ انحفظ. أشّر على كل خطوة بعد ما تنفذها.</p>}
                  <StepList steps={w.steps} done={w.done} onToggle={(stepId, checked) => toggle(w.id, stepId, checked)} />
                  {note?.id === w.id && <p className="text-sm leading-7 bg-[#fff2df] text-[#805b20] rounded-xl p-3">{note.text}</p>}
                  <p className="text-xs text-[#737373] leading-6">
                    {w.allocation.personal > 0 && <>❤️ و{fmt(w.allocation.personal)} ريال لك، اصرفها براحتك. </>}
                    {RESERVES_ENABLED ? 'الفلوس المحجوزة والطوارئ يزيدون' : 'الطوارئ تزيد والدين ينقص'} بالخطوات المؤشّرة فقط.
                  </p>
                  <ReportButton windfallId={w.id} title={`خطة ${w.source} · ${fmt(w.amount)} ريال`} label="احفظ خطة المبلغ (صورة أو PDF)" />
                  {confirmDelete === w.id ? (
                    <button onClick={() => remove(w.id)} className="text-xs text-white bg-[#9d3b35] rounded px-3 py-1.5">تأكيد الحذف{RESERVES_ENABLED && ' (يشيل اللي أضافه للمحجوز)'}</button>
                  ) : (
                    <button onClick={() => setConfirmDelete(w.id)} className="text-xs text-[#9d3b35]">حذف هذا المبلغ</button>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeChoice({ selected, disabled, onClick, title, hint }: {
  selected: boolean; disabled?: boolean; onClick: () => void; title: string; hint: string;
}) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick}
      className={`text-right border rounded-xl px-4 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed ${selected ? 'border-[#173f35] bg-[#dfece7]' : 'border-[#e8e6df] bg-white hover:border-[#b7c8c1]'}`}>
      <strong className="block text-sm">{title}</strong>
      <small className="text-[#737373]">{hint}</small>
    </button>
  );
}
