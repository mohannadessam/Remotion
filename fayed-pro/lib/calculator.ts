// منطق توزيع الفائض — منقول من fayed_mvp.html (نفس الجداول والقواعد بالضبط)
// أي تعديل على النسب هنا يجب أن يُطبَّق أيضًا في النسخة المجانية (fayed_mvp.html) والعكس.

export type DebtStatus = 'none' | 'normal' | 'high';
export type Goal = 'safety' | 'near' | 'wealth' | 'balanced';

export interface PlanInput {
  surplus: number;
  essential: number;
  emergency: number;
  debt: DebtStatus;
  goal: Goal;
}

export interface Allocation {
  emergency: number;
  debt: number;
  goal: number;
  invest: number;
  personal: number;
}

export interface PlanResult {
  months: number;
  coveredMonths: string;
  tier: 0 | 1 | 2 | 3;
  amounts: Allocation;
  emergencyGoal: number;
  remainingEmergency: number;
  emergencyProgress: number;
  monthsToGoal: number | null;
  statusLabel: string;
  reason: string;
}

const PERSONAL_PCT = 10;

/**
 * جدول التوزيع: كل صف = [طوارئ, ديون, هدف, استثمار]
 * كل صف يجمع إلى 90 نقطة، والـ10 المتبقية = إنفاق شخصي ثابت.
 * المستويات (tier) حسب تغطية الاحتياطي:
 *   0: أقل من شهر | 1: 1–3 أشهر | 2: 3–6 أشهر | 3: 6 أشهر فأكثر
 */
const TABLES: Record<'none' | 'high', Record<Goal, number[][]>> = {
  none: {
    safety:   [[70,0,10,10],[60,0,10,20],[45,0,15,30],[0,0,30,60]],
    near:     [[55,0,30,5], [40,0,40,10],[25,0,45,20],[0,0,60,30]],
    wealth:   [[60,0,5,25], [40,0,10,40],[25,0,10,55],[0,0,10,80]],
    balanced: [[60,0,15,15],[40,0,25,25],[25,0,30,35],[0,0,40,50]],
  },
  high: {
    safety:   [[45,40,0,5], [35,45,0,10],[20,50,0,20],[0,65,0,25]],
    near:     [[35,40,10,5],[25,45,15,5],[15,50,20,5],[0,60,25,5]],
    wealth:   [[35,45,0,10],[25,45,0,20],[15,50,0,25],[0,60,0,30]],
    balanced: [[35,40,5,10],[25,45,10,10],[15,50,10,15],[0,60,10,20]],
  },
};

const STATUS_LABELS = ['احتياطي أقل من شهر', 'احتياطي قيد البناء', 'احتياطي جيد', 'احتياطي 6 أشهر+'];

function buildReason(
  tier: 0 | 1 | 2 | 3,
  coveredMonths: string,
  debt: DebtStatus,
  goal: Goal,
  transferredExcess: boolean
): string {
  let reason: string;
  if (tier === 0) reason = `احتياطيك يغطي ${coveredMonths} شهر، لذلك أعطينا بناء الأمان المالي الأولوية.`;
  else if (tier === 1) reason = `احتياطيك يغطي ${coveredMonths} شهر، لذلك نركز أولًا على رفع مستوى الأمان مع استمرار تمويل أهدافك.`;
  else if (tier === 2) reason = `احتياطيك يغطي ${coveredMonths} شهر، لذلك نوازن بين تقوية الأمان وتمويل أهدافك والاستثمار.`;
  else reason = `احتياطيك يغطي ${coveredMonths} شهر وقد وصلت لهدف 6 أشهر، لذلك لا نخصص شيئًا للطوارئ ونوجه الفائض لأهدافك.`;

  if (debt === 'high') reason += ' ومع وجود دين عالي الأولوية، أعطينا سداد الدين وزنًا أكبر قبل زيادة الاستثمار.';
  if (debt === 'normal') reason += ' وخصصنا جزءًا لسداد دينك دون التضحية بالأمان.';
  if (goal === 'safety') reason += ' ولأن هدفك الأمان المالي، أعطينا الطوارئ أولوية أعلى.';
  if (goal === 'near') reason += ' ولأن لديك هدفًا قريبًا، خصصنا له جزءًا واضحًا من الفائض.';
  if (goal === 'wealth') reason += ' وبما أن هدفك بناء الثروة على المدى الطويل، رفعنا حصة الاستثمار بعد مراعاة مستوى الأمان.';
  if (goal === 'balanced') reason += ' ولأنك تفضّل التوازن، وزّعنا الفائض على أكثر من بند.';
  if (transferredExcess) reason += ' وسيكتمل صندوق الطوارئ بهذا التخصيص، لذلك حوّلنا الزيادة إلى بند آخر.';

  return reason;
}

export function calculatePlan(input: PlanInput): PlanResult {
  const { surplus, essential, emergency, debt, goal } = input;
  const months = emergency / essential;
  const coveredMonths = Number.isInteger(months) ? String(months) : months.toFixed(1);
  const tier: 0 | 1 | 2 | 3 = months < 1 ? 0 : months < 3 ? 1 : months < 6 ? 2 : 3;

  const tableKey = debt === 'high' ? 'high' : 'none';
  const row = TABLES[tableKey][goal][tier];
  const pts = { emergency: row[0], debt: row[1], goal: row[2], invest: row[3] };

  if (debt === 'normal') {
    const want = tier < 2 ? 15 : 10;
    const pool = pts.goal + pts.invest;
    const take = Math.min(want, pool);
    if (pool > 0) {
      const g = pts.goal, i = pts.invest;
      pts.goal = g - (take * g) / pool;
      pts.invest = i - (take * i) / pool;
    }
    pts.debt = take;
  }

  const emergencyGoal = essential * 6;
  const remainingEmergency = Math.max(0, emergencyGoal - emergency);
  const raw: Record<'emergency' | 'debt' | 'goal' | 'invest', number> = {
    emergency: (surplus * pts.emergency) / 100,
    debt: (surplus * pts.debt) / 100,
    goal: (surplus * pts.goal) / 100,
    invest: (surplus * pts.invest) / 100,
  };

  const target = debt === 'high' ? 'debt' : goal === 'near' ? 'goal' : 'invest';
  let transferredExcess = false;
  if (raw.emergency > remainingEmergency) {
    const excess = raw.emergency - remainingEmergency;
    raw.emergency = remainingEmergency;
    raw[target] += excess;
    transferredExcess = pts.emergency > 0;
  }

  const step10 = surplus >= 1000 ? 10 : 1;
  const amounts: Allocation = {
    personal: Math.round(surplus * PERSONAL_PCT) / 100,
    emergency: Math.round(raw.emergency / step10) * step10,
    debt: Math.round(raw.debt / step10) * step10,
    goal: Math.round(raw.goal / step10) * step10,
    invest: Math.round(raw.invest / step10) * step10,
  };
  const keys: (keyof Omit<Allocation, 'personal'>)[] = ['emergency', 'debt', 'goal', 'invest'];
  const diff =
    Math.round((surplus - amounts.personal - keys.reduce((a, k) => a + amounts[k], 0)) * 100) / 100;
  const biggest = keys.reduce((a, b) => (amounts[b] > amounts[a] ? b : a), keys[0]);
  amounts[biggest] = Math.max(0, Math.round((amounts[biggest] + diff) * 100) / 100);
  // التقريب ممكن يرفع الطوارئ فوق هدفها بريالات: نرجّع الزايد لبند الفائض
  const over = Math.round((amounts.emergency - remainingEmergency) * 100) / 100;
  if (over > 0) {
    amounts.emergency = Math.round(remainingEmergency * 100) / 100;
    amounts[target] = Math.round((amounts[target] + over) * 100) / 100;
  }

  const emergencyProgress = Math.min(100, (emergency / emergencyGoal) * 100);
  const monthsToGoal =
    amounts.emergency > 0 ? Math.ceil(remainingEmergency / amounts.emergency) : null;

  return {
    months,
    coveredMonths,
    tier,
    amounts,
    emergencyGoal,
    remainingEmergency,
    emergencyProgress,
    monthsToGoal,
    statusLabel: STATUS_LABELS[tier],
    reason: buildReason(tier, coveredMonths, debt, goal, transferredExcess),
  };
}

export const ALLOCATION_LABELS: Record<keyof Allocation, string> = {
  emergency: '🛡️ صندوق الطوارئ',
  debt: '💳 سداد الديون',
  goal: '🎯 الهدف المالي',
  invest: '📈 الاستثمار طويل الأجل',
  personal: '❤️ إنفاق شخصي',
};

export const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
