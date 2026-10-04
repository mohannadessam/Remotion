import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmt } from '@/lib/calculator';
import { computeStreak } from '@/lib/retention';
import { monthLabel } from '@/lib/month';
import { carriedEmergency, loadPlans, loadWindfalls } from '@/lib/data';
import ReportButton from '@/components/report-dialog';
import { RESERVES_ENABLED } from '@/lib/features';
import HistoryChart from './history-chart';

export default async function HistoryPage() {
  const supabase = await createClient();
  const [rows, windfalls] = await Promise.all([loadPlans(supabase), loadWindfalls(supabase)]);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-[#e8e6df] rounded-3xl p-10 text-center">
        <h1 className="text-2xl font-extrabold mb-2">ما عندك سجل بعد</h1>
        <p className="text-[#737373]">
          احفظ <Link href="/app/plan" className="underline">خطة هالشهر</Link> عشان يبدأ سجلك يتكوّن.
        </p>
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const emergencyGoal = latest.essential * 6;
  // الرصيد الحالي = أول آخر شهر + كل خطوة طوارئ مؤشّرة بعده (خطة الشهر والمبالغ اللي وصلت)
  // — نفس الرقم اللي تبني عليه صفحة "وصلني مبلغ" وتعبئة الشهر الجاي
  const emergencyNow = carriedEmergency(latest, windfalls).value;
  const emergencyDelta = emergencyNow - latest.emergency;
  const streak = computeStreak(rows.map((r) => r.month));

  const chartData = rows.map((r) => ({
    month: monthLabel(r.month, 'short'),
    emergency: r.emergency,
    surplus: r.surplus,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">سجل خططك</h1>
          <p className="text-[#737373]">تطور صندوق الطوارئ والفائض، وكم نفّذت من خطة كل شهر.</p>
        </div>
        {streak >= 2 && (
          <div className="bg-[#fff2df] text-[#805b20] rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap">
            🔥 {streak === 2 ? 'شهرين متتاليين' : `${streak} أشهر متتالية`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#e8e6df] rounded-2xl p-4">
          <div className="text-xs text-[#737373]">صندوق الطوارئ الحالي</div>
          <div className="text-xl font-extrabold mt-1">{fmt(emergencyNow)} ريال</div>
          <div className={`text-xs mt-1 ${emergencyDelta > 0 ? 'text-[#173f35]' : 'text-[#737373]'}`}>
            {emergencyDelta > 0 ? `▲ ${fmt(emergencyDelta)} ريال من خطوات نفّذتها` : `أول ${monthLabel(latest.month)}، وما أشّرت تحويل للطوارئ بعد`}
          </div>
        </div>
        <div className="bg-white border border-[#e8e6df] rounded-2xl p-4">
          <div className="text-xs text-[#737373]">هدف صندوق الطوارئ</div>
          <div className="text-xl font-extrabold mt-1">{fmt(emergencyGoal)} ريال</div>
          <div className="text-xs text-[#737373] mt-1">{Math.min(100, Math.round((emergencyNow / emergencyGoal) * 100))}% مكتمل</div>
        </div>
      </div>

      <div className="bg-white border border-[#e8e6df] rounded-3xl p-6">
        <h2 className="font-bold mb-4">تطور صندوق الطوارئ والفائض</h2>
        <HistoryChart data={chartData} />
      </div>

      <div className="bg-white border border-[#e8e6df] rounded-3xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-[#fbfaf7] text-[#737373]">
            <tr>
              <th className="text-right py-3 px-4 font-medium">الشهر</th>
              <th className="text-right py-3 px-4 font-medium">الفائض</th>
              {RESERVES_ENABLED && <th className="text-right py-3 px-4 font-medium">محجوز</th>}
              <th className="text-right py-3 px-4 font-medium">الطوارئ أول الشهر</th>
              <th className="text-right py-3 px-4 font-medium">نُفّذ</th>
              <th className="py-3 px-4"><span className="sr-only">تقرير</span></th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => {
              const total = r.steps.length;
              const doneN = r.steps.filter((s) => r.done[s.id]).length;
              const complete = total > 0 && doneN === total;
              return (
                <tr key={r.month} className="border-t border-[#e8e6df]">
                  <td className="py-3 px-4">{monthLabel(r.month)}</td>
                  <td className="py-3 px-4">{fmt(r.surplus)}</td>
                  {RESERVES_ENABLED && <td className="py-3 px-4">{fmt(r.reserved)}</td>}
                  <td className="py-3 px-4">{fmt(r.emergency)}</td>
                  <td className={`py-3 px-4 ${complete ? 'text-[#173f35] font-bold' : 'text-[#737373]'}`}>
                    {total ? `${doneN}/${total}${complete ? ' ✓' : ''}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <ReportButton month={r.month} label="تقرير" className="text-[#173f35] font-bold text-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {windfalls.length > 0 && (
        <div>
          <h2 className="font-bold mb-3">مبالغ وصلتك</h2>
          <div className="bg-white border border-[#e8e6df] rounded-3xl overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-[#fbfaf7] text-[#737373]">
                <tr>
                  <th className="text-right py-3 px-4 font-medium">الشهر</th>
                  <th className="text-right py-3 px-4 font-medium">المصدر</th>
                  <th className="text-right py-3 px-4 font-medium">المبلغ</th>
                  {RESERVES_ENABLED && <th className="text-right py-3 px-4 font-medium">محجوز</th>}
                  <th className="text-right py-3 px-4 font-medium">نُفّذ</th>
                </tr>
              </thead>
              <tbody>
                {windfalls.map((w) => {
                  const total = w.steps.length;
                  const doneN = w.steps.filter((s) => w.done[s.id]).length;
                  const complete = total > 0 && doneN === total;
                  return (
                    <tr key={w.id} className="border-t border-[#e8e6df]">
                      <td className="py-3 px-4">{monthLabel(w.month)}</td>
                      <td className="py-3 px-4">{w.source}</td>
                      <td className="py-3 px-4">{fmt(w.amount)}</td>
                      {RESERVES_ENABLED && <td className="py-3 px-4">{fmt(w.reserved)}</td>}
                      <td className={`py-3 px-4 ${complete ? 'text-[#173f35] font-bold' : 'text-[#737373]'}`}>
                        {total ? `${doneN}/${total}${complete ? ' ✓' : ''}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#737373] mt-2">
            تأشير الخطوات من صفحة <Link href="/app/windfall" className="underline">وصلني مبلغ</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
