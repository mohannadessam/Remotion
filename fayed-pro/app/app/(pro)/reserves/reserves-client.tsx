'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadReserves, monthSources, type PlanRow, type WindfallRow } from '@/lib/data';
import { needFor, pendingOf, planSource, savedOf, whenText, withPending, type Reserve } from '@/lib/planner';
import { monthKey, monthLabel, nextDueKey } from '@/lib/month';
import { fmt } from '@/lib/calculator';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const noopSubscribe = () => () => {};

export default function ReservesClient({ initial, plans, windfalls }: { initial: Reserve[]; plans: PlanRow[]; windfalls: WindfallRow[] }) {
  const month = useSyncExternalStore(noopSubscribe, () => monthKey(), () => null);
  const [rawReserves, setReserves] = useState(initial);
  // الخطوات المحفوظة هالشهر وباقي ما تحوّلت: تظهر "بانتظار التحويل"
  const reserves = useMemo(
    () => (month ? withPending(rawReserves, monthSources(plans, windfalls, month)) : rawReserves),
    [rawReserves, plans, windfalls, month]
  );
  // اللي باقي يلزم حجزه هالشهر، بعد اللي تحوّل فعلًا من خطة الشهر
  const dueNow = (r: Reserve, m: string) => Math.max(0, needFor(r, m).need - (r.contributions[planSource(m)] ?? 0));
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueMonth, setDueMonth] = useState(3);
  const [initialSaved, setInitialSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function refresh() {
    setReserves(await loadReserves(createClient()));
  }

  async function run(action: () => PromiseLike<{ error: unknown }>, failText: string) {
    setBusy(true);
    setError('');
    const { error: e } = await action();
    if (e) setError(failText);
    else await refresh();
    setBusy(false);
    return !e;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim() || !(amt > 0) || !month) { setError('اكتب الاسم والمبلغ.'); return; }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ok = await run(
      () => supabase.from('reserves').insert({
        user_id: user.id,
        name: name.trim().slice(0, 80),
        amount: amt,
        due_month: dueMonth,
        due_key: nextDueKey(dueMonth, month),
        initial_saved: Math.min(amt, Math.max(0, Number(initialSaved) || 0)),
      }),
      'تعذّر الإضافة، حاول مرة ثانية.'
    );
    if (ok) { setName(''); setAmount(''); setInitialSaved(''); }
  }

  const sorted = [...reserves].sort((a, b) => a.dueKey.localeCompare(b.dueKey));
  const total = reserves.reduce((a, r) => a + r.amount, 0);
  const totalSaved = reserves.reduce((a, r) => a + Math.min(r.amount, savedOf(r)), 0);
  const monthlyNeed = month ? reserves.reduce((a, r) => a + dueNow(r, month), 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold mb-1">فلوس محجوزة</h1>
        <p className="text-[#737373] leading-7">
          المصاريف الكبيرة اللي تجي مرة بالسنة. نقسمها على الأشهر اللي قبلها، فتنحجز حصتها من فائضك كل شهر قبل أي توزيع.
        </p>
        <p className="text-xs text-[#737373] leading-6 mt-2">
          هذي مصاريف قادمة تجهّز لها (إيجار، مدارس، تأمين)، مو ديون. الدين اللي عليك (قرض، بطاقة، تمويل) تسجّل كم باقي منه في شاشة الخطة.
        </p>
      </div>

      {sorted.length > 0 && month && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#e8e6df] rounded-2xl p-4">
              <div className="text-xs text-[#737373]">جاهز من كل الالتزامات</div>
              <div className="text-xl font-extrabold mt-1">{fmt(totalSaved)} ريال</div>
              <div className="text-xs text-[#737373] mt-1">من {fmt(total)} ريال</div>
            </div>
            <div className="bg-white border border-[#e8e6df] rounded-2xl p-4">
              <div className="text-xs text-[#737373]">يلزم حجزه هالشهر</div>
              <div className="text-xl font-extrabold mt-1">{fmt(monthlyNeed)} ريال</div>
              <div className="text-xs text-[#737373] mt-1">ينحسب تلقائيًا في خطتك</div>
            </div>
          </div>

          <div className="bg-white border border-[#e8e6df] rounded-3xl p-4 space-y-3">
            {sorted.map((r) => {
              const saved = Math.min(r.amount, savedOf(r));
              const pct = Math.round((saved / r.amount) * 100);
              const n = needFor(r, month);
              const due = dueNow(r, month);
              const waiting = pendingOf(r);
              return (
                <div key={r.id} className={`border rounded-2xl p-4 ${n.overdue ? 'border-[#9d3b35]' : 'border-[#e8e6df]'}`}>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <strong>{r.name}</strong>
                      <div className={`text-xs mt-1 ${n.overdue ? 'text-[#9d3b35]' : 'text-[#737373]'}`}>
                        {fmt(r.amount)} ريال · {monthLabel(r.dueKey)} · {whenText(r, month)}
                      </div>
                    </div>
                    <div className="flex gap-1 text-xs shrink-0">
                      <button disabled={busy} onClick={() => run(() => createClient().rpc('mark_reserve_paid', { p_id: r.id }), 'تعذّر التحديث.')} className="text-[#173f35] font-bold px-2 py-1">
                        دفعته ✓
                      </button>
                      {confirmDelete === r.id ? (
                        <button disabled={busy} onClick={() => { setConfirmDelete(null); run(() => createClient().from('reserves').delete().eq('id', r.id), 'تعذّر الحذف.'); }} className="text-white bg-[#9d3b35] rounded px-2 py-1">
                          تأكيد الحذف
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDelete(r.id)} className="text-[#9d3b35] px-2 py-1">حذف</button>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-[#eee] rounded-full overflow-hidden">
                    <div className="h-full bg-[#b98b42] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-2 gap-2 flex-wrap">
                    <span>جاهز {fmt(saved)} ريال ({pct}%)</span>
                    <span>
                      {saved >= r.amount ? 'مكتمل ✓' : due > 0 ? <>احجز <b className="text-[#b98b42]">{fmt(due)} ريال</b> هالشهر</> : 'حصة هالشهر محجوزة ✓'}
                    </span>
                  </div>
                  {waiting > 0 && (
                    <div className="text-xs text-[#805b20] mt-1">
                      ⏳ {fmt(waiting)} ريال في خطواتك بانتظار التحويل. أشّر عليها بعد ما تحوّلها.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <form onSubmit={add} className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-4">
        <h2 className="font-bold">{sorted.length ? 'أضف التزام' : 'أضف أول التزام'}</h2>
        <p className="text-xs text-[#737373] leading-6">
          أضف هنا فقط اللي تدفعه مرة بالسنة. اللي تدفعه كل شهر مكانه خانة &quot;احتياجك الأساسي&quot; في الخطة. كل مصروف ينكتب في مكان واحد، مو في الاثنين.
        </p>
        {sorted.length === 0 && (
          <p className="text-sm text-[#737373] leading-7">مثل: الإيجار السنوي، رسوم المدارس، رمضان والعيد، سفر الصيف، تجديد التأمين.</p>
        )}
        <div>
          <label htmlFor="rName" className="block text-sm font-bold mb-2">الاسم</label>
          <input id="rName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="إيجار البيت" className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 outline-none focus:border-[#173f35]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rAmount" className="block text-sm font-bold mb-2">المبلغ</label>
            <input id="rAmount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="18000" dir="ltr" className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 text-center font-bold outline-none focus:border-[#173f35]" />
          </div>
          <div>
            <label htmlFor="rMonth" className="block text-sm font-bold mb-2">شهر الاستحقاق</label>
            <select id="rMonth" value={dueMonth} onChange={(e) => setDueMonth(Number(e.target.value))} className="w-full border border-[#e8e6df] rounded-xl px-3 py-3 bg-white outline-none focus:border-[#173f35]">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="rSaved" className="block text-sm font-bold mb-2">جاهز منه حاليًا (اختياري)</label>
          <input id="rSaved" type="number" inputMode="decimal" min={0} value={initialSaved} onChange={(e) => setInitialSaved(e.target.value)} placeholder="0" dir="ltr" className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 text-center font-bold outline-none focus:border-[#173f35]" />
        </div>
        <button type="submit" disabled={busy} className="w-full bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-60">أضف</button>
        {error && <p className="text-sm text-[#9d3b35] text-center">{error}</p>}
      </form>
    </div>
  );
}
