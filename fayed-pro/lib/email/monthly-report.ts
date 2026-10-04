import { fmt } from '@/lib/calculator';

export interface MonthlyReportData {
  appUrl: string;
  monthLabel: string; // الشهر اللي انتهى، مثال: "أغسطس 2026"
  nextMonthLabel: string; // الشهر الجديد، مثال: "سبتمبر 2026"
  emergency: number;
  emergencyGoal: number;
  emergencyProgress: number; // 0-100
  emergencyDelta: number | null; // فرق عن الشهر السابق، null لو أول شهر
  surplus: number;
  stepsDone: number;
  stepsTotal: number;
  unsubscribeUrl: string;
}

const COLORS = {
  bg: '#f7f6f2',
  card: '#ffffff',
  ink: '#171717',
  muted: '#737373',
  line: '#e8e6df',
  accent: '#173f35',
  accentSoft: '#dfece7',
  gold: '#b98b42',
};

export function emailWrapper(bodyHtml: string, unsubscribeUrl: string) {
  return `
<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:${COLORS.bg};font-family:Arial,Tahoma,sans-serif;color:${COLORS.ink}">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:22px;font-weight:800;margin-bottom:24px">
      فائض<span style="color:${COLORS.gold}">.</span>
      <span style="font-size:11px;font-weight:700;color:${COLORS.accent};background:${COLORS.accentSoft};padding:4px 10px;border-radius:99px;margin-inline-start:6px;vertical-align:middle">PRO</span>
    </div>
    ${bodyHtml}
    <p style="font-size:11px;color:${COLORS.muted};line-height:1.8;margin-top:28px">
      تصلك هذي الرسالة لأنك مشترك في فائض PRO. هذي أداة تعليمية لتنظيم الفائض الشهري وليست نصيحة استثمارية.
      <br><a href="${unsubscribeUrl}" style="color:${COLORS.muted}">إيقاف هذي الرسائل</a>
    </p>
  </div>
</body>
</html>`;
}

/** تقرير الشهر لمستخدم حفظ خطته */
export function renderMonthlyReportEmail(data: MonthlyReportData) {
  const deltaHtml =
    data.emergencyDelta === null
      ? `<div style="font-size:13px;color:${COLORS.muted};margin-top:4px">أول شهر مسجّل في سجلك</div>`
      : `<div style="font-size:13px;color:${data.emergencyDelta >= 0 ? COLORS.accent : '#9d3b35'};margin-top:4px">
          ${data.emergencyDelta >= 0 ? '▲' : '▼'} ${fmt(Math.abs(data.emergencyDelta))} ريال عن الخطة السابقة
        </div>`;

  const progressPct = Math.min(100, Math.round(data.emergencyProgress));

  const execPct = data.stepsTotal ? Math.round((data.stepsDone / data.stepsTotal) * 100) : 0;
  const execHtml = data.stepsTotal
    ? `<div style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:16px;padding:18px;margin-bottom:16px">
      <div style="font-size:12px;color:${COLORS.muted}">نفّذت من خطة الشهر</div>
      <div style="font-size:24px;font-weight:800;margin-top:4px;color:${COLORS.accent}">${data.stepsDone} من ${data.stepsTotal} خطوات</div>
      <div style="height:8px;background:${COLORS.line};border-radius:99px;overflow:hidden;margin-top:14px">
        <div style="height:100%;width:${execPct}%;background:${COLORS.accent};border-radius:99px"></div>
      </div>
    </div>`
    : '';

  return emailWrapper(`
    <h1 style="font-size:20px;margin:0 0 6px">ملخص ${data.monthLabel}</h1>
    <p style="font-size:14px;color:${COLORS.muted};line-height:1.7;margin:0 0 20px">
      هذا أداؤك المالي هذا الشهر، ومقارنة سريعة بالشهر اللي قبله.
    </p>
    ${execHtml}

    <div style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:16px;padding:18px;margin-bottom:16px">
      <div style="font-size:12px;color:${COLORS.muted}">صندوق الطوارئ</div>
      <div style="font-size:24px;font-weight:800;margin-top:4px">${fmt(data.emergency)} ريال</div>
      ${deltaHtml}
      <div style="height:8px;background:${COLORS.line};border-radius:99px;overflow:hidden;margin-top:14px">
        <div style="height:100%;width:${progressPct}%;background:${COLORS.accent};border-radius:99px"></div>
      </div>
      <div style="font-size:12px;color:${COLORS.muted};margin-top:6px">${progressPct}% من هدف ${fmt(data.emergencyGoal)} ريال</div>
    </div>

    <div style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:16px;padding:18px;margin-bottom:24px">
      <div style="font-size:12px;color:${COLORS.muted}">الفائض المُوزَّع هذا الشهر</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px">${fmt(data.surplus)} ريال</div>
    </div>

    <a href="${data.appUrl}/app/plan" style="display:block;text-align:center;background:${COLORS.accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px;border-radius:12px">
      ابدأ خطة ${data.nextMonthLabel}
    </a>
    <a href="${data.appUrl}/app/history" style="display:block;text-align:center;color:${COLORS.accent};text-decoration:none;font-weight:700;font-size:13px;padding:12px;margin-top:6px">
      شاهد سجلك الكامل
    </a>
  `, data.unsubscribeUrl);
}

/** تذكير لمستخدم ما حفظ خطة هذا الشهر بعد */
export function renderReminderEmail(params: { appUrl: string; monthLabel: string; unsubscribeUrl: string }) {
  return emailWrapper(`
    <h1 style="font-size:20px;margin:0 0 6px">حان وقت خطة ${params.monthLabel}</h1>
    <p style="font-size:14px;color:${COLORS.muted};line-height:1.8;margin:0 0 24px">
      ما سجّلت خطتك لهذا الشهر بعد. دقيقتين وتحدّث أرقامك عشان يستمر سجلك متكامل وتشوف تطور صندوق الطوارئ بدقة.
    </p>
    <a href="${params.appUrl}/app/plan" style="display:block;text-align:center;background:${COLORS.accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px;border-radius:12px">
      حدّث خطة هذا الشهر
    </a>
  `, params.unsubscribeUrl);
}
