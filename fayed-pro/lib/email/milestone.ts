import { fmt } from '@/lib/calculator';

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

const MILESTONE_COPY: Record<number, { emoji: string; title: string }> = {
  25: { emoji: '🌱', title: 'ربع الطريق' },
  50: { emoji: '🚀', title: 'نص الطريق' },
  75: { emoji: '🔥', title: 'اقتربت' },
  100: { emoji: '🏆', title: 'صندوق طوارئ مكتمل' },
};

export function renderMilestoneEmail(params: {
  appUrl: string;
  milestone: 25 | 50 | 75 | 100;
  emergency: number;
  emergencyGoal: number;
  streak: number;
  unsubscribeUrl: string;
}) {
  const copy = MILESTONE_COPY[params.milestone];
  const streakLine =
    params.streak >= 2
      ? `<div style="font-size:13px;color:${COLORS.muted};margin-top:10px">مع هذا، وصلت لـ ${params.streak} أشهر متتالية تسجّل خطتك 🔥 استمر.</div>`
      : '';

  return `
<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:${COLORS.bg};font-family:Arial,Tahoma,sans-serif;color:${COLORS.ink}">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;text-align:center">
    <div style="font-size:44px;margin-bottom:8px">${copy.emoji}</div>
    <h1 style="font-size:22px;margin:0 0 8px">${copy.title}</h1>
    <p style="font-size:14px;color:${COLORS.muted};line-height:1.8;margin:0 0 20px">
      وصلت ${params.milestone}% من هدف صندوق الطوارئ.
    </p>

    <div style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:16px;padding:20px;margin-bottom:8px;text-align:right">
      <div style="font-size:12px;color:${COLORS.muted}">صندوق الطوارئ الآن</div>
      <div style="font-size:26px;font-weight:800;margin-top:4px">${fmt(params.emergency)} ريال</div>
      <div style="height:8px;background:${COLORS.line};border-radius:99px;overflow:hidden;margin-top:14px">
        <div style="height:100%;width:${params.milestone}%;background:${COLORS.accent};border-radius:99px"></div>
      </div>
      <div style="font-size:12px;color:${COLORS.muted};margin-top:6px">من هدف ${fmt(params.emergencyGoal)} ريال</div>
    </div>
    ${streakLine}

    <a href="${params.appUrl}/app/history" style="display:block;text-align:center;background:${COLORS.accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px;border-radius:12px;margin-top:20px">
      شاهد رحلتك كاملة
    </a>

    <p style="font-size:11px;color:${COLORS.muted};line-height:1.8;margin-top:28px">
      تصلك هذي الرسالة لأنك مشترك في فائض PRO.
      <br><a href="${params.unsubscribeUrl}" style="color:${COLORS.muted}">إيقاف هذي الرسائل</a>
    </p>
  </div>
</body>
</html>`;
}
