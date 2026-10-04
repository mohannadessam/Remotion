// حساب عداد الاستمرارية (streak) واكتشاف تجاوز عتبات صندوق الطوارئ (milestones)
// يُستخدم في route الإشعار الفوري بعد الحفظ، وفي عرض شارة الاستمرارية بالواجهة.

import { monthDiff } from '@/lib/month';

export const MILESTONE_THRESHOLDS = [25, 50, 75, 100] as const;

/**
 * عدد الأشهر المتتالية المحفوظة، عدًا من آخر شهر محفوظ للخلف.
 * `months` قائمة بصيغة YYYY-MM-DD (أول يوم من كل شهر)، بأي ترتيب.
 */
export function computeStreak(months: string[]): number {
  if (months.length === 0) return 0;
  const sorted = [...new Set(months)].sort(); // تصاعديًا، بلا تكرار
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (monthDiff(sorted[i - 1], sorted[i]) === 1) streak++;
    else break;
  }
  return streak;
}

export type Milestone = (typeof MILESTONE_THRESHOLDS)[number];

/**
 * كل العتبات اللي وصلها هذا التقدّم، تصاعديًا. آخر عنصر = أعلى عتبة.
 * التحقق من "هل هي جديدة؟" يصير عبر سجل notifications_sent، مو بمقارنة الشهر السابق —
 * لأن المقارنة وحدها تعيد إرسال نفس التهنئة كل ما أعاد المستخدم حفظ نفس الشهر.
 */
export function reachedMilestones(progress: number): Milestone[] {
  return MILESTONE_THRESHOLDS.filter((t) => progress >= t);
}
