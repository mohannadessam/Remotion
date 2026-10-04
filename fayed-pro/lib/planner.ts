// منطق "وش أسوي بفلوسي؟" فوق الحاسبة الأساسية:
//  1. الفلوس المحجوزة تنحجز أولًا من الفائض (الأقدم موعدًا أول)
//  2. الباقي يتوزع بنفس منطق الحاسبة (lib/calculator.ts)
//  3. الخطة تتحول لخطوات يأشّر عليها المستخدم بعد التنفيذ
// دوال نقية بدون قاعدة بيانات — تستخدمها الواجهة للمعاينة، والخادم عند الحفظ.

import { calculatePlan, fmt, type Allocation, type DebtStatus, type Goal, type PlanResult } from './calculator';
import { monthDiff } from './month';
import { RESERVES_ENABLED } from './features';

export interface Reserve {
  id: string;
  name: string;
  amount: number;
  dueMonth: number; // 1-12
  dueKey: string; // الموعد القادم الفعلي "YYYY-MM-01"
  initialSaved: number;
  contributions: Record<string, number>; // المصدر → المبلغ ("plan:YYYY-MM-01" أو "wf:<id>")
  /** خطوات محفوظة لهذا الشهر وما انأشّر عليها بعد (نفس مفاتيح المصدر) — انظر withPending */
  pending?: Record<string, number>;
}

export interface Profile {
  essential: number;
  emergency: number;
  debt: DebtStatus;
  goal: Goal;
  /** كم باقي من الدين (null = ما نعرف، فما فيه سقف لحصة الدين) */
  debtLeft?: number | null;
}

export interface Step {
  id: string; // "res:<reserveId>" أو emergency | debt | goal | invest
  text: string;
  amount: number;
  reserveId?: string;
}

/** وش يعني كل بند عمليًا — يظهر تحت اسمه في الخطة وفي "وصلني مبلغ" */
export const ALLOCATION_HINTS: Record<keyof Allocation, string> = {
  emergency: 'حساب منفصل ما تلمسه إلا وقت الطوارئ',
  debt: 'دفعة إضافية فوق قسطك الشهري، ابدأ بالدين الأعلى تكلفة. لو دينك أقل من هذا المبلغ، سدده كامل وحوّل الباقي للاستثمار',
  goal: 'حساب ادخار لهدفك القريب',
  invest: 'مبلغ للمدى الطويل (5 سنوات وأكثر)',
  personal: 'لك، اصرفها براحتك',
};

/**
 * حصة سداد الدين ما تتجاوز الباقي من الدين فعلًا؛ الزايد يروح للهدف القريب أو الاستثمار.
 * يرجّع جملة توضيح تنضاف لسبب التوزيع (فاضية لو ما تغيّر شي).
 */
export function capDebt(amounts: Allocation, profile: Pick<Profile, 'debtLeft' | 'goal'>): { amounts: Allocation; note: string } {
  const left = profile.debtLeft;
  if (left == null || amounts.debt <= left) return { amounts, note: '' };
  const to = profile.goal === 'near' ? 'goal' : 'invest';
  const moved = Math.round((amounts.debt - left) * 100) / 100;
  const out = { ...amounts, debt: left, [to]: Math.round((amounts[to] + moved) * 100) / 100 };
  const note = left > 0
    ? ` حصة سداد الدين كانت أكبر من الباقي عليك (${fmt(left)} ريال)، فتسدده كامل وحوّلنا الزايد (${fmt(moved)} ريال) إلى ${to === 'goal' ? 'الهدف المالي' : 'الاستثمار'}.`
    : ` دينك مسدد، فحوّلنا حصته (${fmt(moved)} ريال) إلى ${to === 'goal' ? 'الهدف المالي' : 'الاستثمار'}. غيّر وضع الديون في خطتك إلى "لا يوجد دين".`;
  return { amounts: out, note };
}

/** سطر تحت بند سداد الدين: كم يبقى من الدين بعد هالدفعة (null لو ما نعرف الدين) */
export function debtAfterText(debtLeft: number | null | undefined, payment: number): string | null {
  if (debtLeft == null) return null;
  const after = Math.max(0, Math.round((debtLeft - payment) * 100) / 100);
  return after === 0
    ? `دفعة إضافية فوق قسطك الشهري. تسدد دينك كامل ✓`
    : `دفعة إضافية فوق قسطك الشهري. دينك ${fmt(debtLeft)} ريال، يبقى منه ${fmt(after)} ريال`;
}

export const planSource = (month: string) => `plan:${month}`;

export function savedOf(r: Reserve, excludeSource?: string): number {
  let s = r.initialSaved;
  for (const [k, v] of Object.entries(r.contributions)) if (k !== excludeSource) s += v;
  return s;
}

/**
 * المحسوب للالتزام = اللي تحوّل فعلًا + اللي محفوظ في خطوات هالشهر وباقي ما تحوّل.
 * نستخدمه عند حساب أي خطة جديدة عشان ما ينحجز نفس الناقص مرتين
 * (مثلًا: خطة الشهر حجزت 1,000 للإيجار، وبعدها وصله مبلغ).
 */
export function committedOf(r: Reserve, excludeSource?: string): number {
  let s = savedOf(r, excludeSource);
  for (const [k, v] of Object.entries(r.pending ?? {})) if (k !== excludeSource) s += v;
  return s;
}

export const pendingOf = (r: Reserve) => Object.values(r.pending ?? {}).reduce((a, b) => a + b, 0);

/** مصدر خطوات محفوظ: خطة شهر أو مبلغ وصل */
export interface StepSource {
  source: string;
  steps: Step[];
  done: Record<string, boolean>;
}

/** يضيف لكل التزام الخطوات المحفوظة اللي باقي ما انأشّر عليها */
export function withPending(reserves: Reserve[], sources: StepSource[]): Reserve[] {
  return reserves.map((r) => {
    const pending: Record<string, number> = {};
    for (const src of sources) {
      const st = src.steps.find((x) => x.reserveId === r.id);
      if (st && !src.done?.[st.id]) pending[src.source] = st.amount;
    }
    return { ...r, pending };
  });
}

/** كم شهر باقي للحجز قبل الموعد (الشهر نفسه = آخر فرصة)، وهل فات الموعد بدون "دفعته" */
export function timing(r: Reserve, planKey: string) {
  const d = monthDiff(planKey, r.dueKey);
  return { left: d <= 0 ? 1 : d, overdue: d < 0, dueNow: d === 0 };
}

const roundUp10 = (n: number) => Math.ceil(n / 10) * 10;

export function needFor(r: Reserve, planKey: string) {
  const gap = Math.max(0, r.amount - committedOf(r, planSource(planKey)));
  const t = timing(r, planKey);
  return { gap, ...t, need: gap === 0 ? 0 : Math.min(gap, roundUp10(gap / t.left)) };
}

export function whenText(r: Reserve, planKey: string): string {
  const t = timing(r, planKey);
  if (t.overdue) return 'فات موعده — دفعته؟';
  if (t.dueNow) return 'مستحق هذا الشهر';
  if (t.left === 1) return 'باقي شهر';
  if (t.left === 2) return 'باقي شهرين';
  return t.left <= 10 ? `باقي ${t.left} أشهر` : `باقي ${t.left} شهر`;
}

export interface ReservedItem {
  reserve: Reserve;
  gap: number;
  need: number;
  take: number;
  overdue: boolean;
}

/** خطوات الالتزامات اللي أشّر عليها في خطة محفوظة: مبالغ تحوّلت فعلًا */
export function lockedFrom(steps: Step[] | null | undefined, done: Record<string, boolean> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of steps ?? []) if (s.reserveId && done?.[s.id]) out[s.reserveId] = s.amount;
  return out;
}

/**
 * حصة كل التزام من فائض الشهر، الأقدم موعدًا أول.
 * `locked`: عند إعادة حساب خطة محفوظة، الخطوة اللي أشّر عليها تبقى بمبلغها
 * (الفلوس تحوّلت فعلًا، فما نعيد حسابها ولا نلغي تأشيرها).
 */
export function reservesForMonth(reserves: Reserve[], surplus: number, planKey: string, locked: Record<string, number> = {}) {
  const items = reserves
    .map((r) => {
      const n = needFor(r, planKey);
      const fixed = locked[r.id];
      return { reserve: r, ...n, need: fixed ?? n.need, gap: fixed !== undefined ? Math.max(n.gap, fixed) : n.gap, fixed: fixed !== undefined };
    })
    .filter((x) => x.need > 0)
    .sort((a, b) => Number(b.fixed) - Number(a.fixed) || a.reserve.dueKey.localeCompare(b.reserve.dueKey));
  let available = surplus;
  let totalNeed = 0;
  const out: ReservedItem[] = items.map((x) => {
    totalNeed += x.need;
    const take = Math.min(x.need, available);
    available -= take;
    return { reserve: x.reserve, gap: x.gap, need: x.need, take, overdue: x.overdue };
  });
  const reserved = out.reduce((a, x) => a + x.take, 0);
  return { items: out, reserved, shortfall: Math.max(0, totalNeed - reserved) };
}

const ZERO: Allocation = { emergency: 0, debt: 0, goal: 0, invest: 0, personal: 0 };

export interface MonthPlan {
  reservedItems: ReservedItem[];
  reserved: number;
  shortfall: number;
  free: number;
  calc: PlanResult; // حالة الطوارئ والتفسير — المبالغ فيها أصفار لو ما بقى شي حر
  allocation: Allocation; // توزيع الباقي فقط
  steps: Step[];
  reason: string;
}

/** يحوّل التوزيع لخطوات ينفذها المستخدم ويأشّر عليها — نفسها للخطة الشهرية ولـ"وصلني مبلغ" */
export function makeSteps(fills: { reserve: Reserve; take: number }[], allocation: Allocation | null): Step[] {
  const steps: Step[] = fills
    .filter((x) => x.take > 0)
    .map((x) => ({
      id: `res:${x.reserve.id}`,
      reserveId: x.reserve.id,
      amount: x.take,
      text: `حوّل ${fmt(x.take)} ريال لحساب "${x.reserve.name}"`,
    }));
  const texts: Record<'emergency' | 'debt' | 'goal' | 'invest', (v: number) => string> = {
    emergency: (v) => `حوّل ${fmt(v)} ريال لحساب الطوارئ`,
    debt: (v) => `ادفع ${fmt(v)} ريال زيادة على الدين`,
    goal: (v) => `حوّل ${fmt(v)} ريال لحساب الهدف`,
    invest: (v) => `خصص ${fmt(v)} ريال للاستثمار طويل الأجل`,
  };
  if (allocation) {
    (Object.keys(texts) as (keyof typeof texts)[]).forEach((k) => {
      if (allocation[k] > 0) steps.push({ id: k, amount: allocation[k], text: texts[k](allocation[k]) });
    });
  }
  return steps;
}

export function planReason(reserved: number, free: number, calcReason: string): string {
  if (free <= 0) return 'كل فائضك هالشهر راح للالتزامات القادمة.';
  if (reserved > 0)
    return `حجزنا ${fmt(reserved)} ريال لالتزاماتك القادمة قبل أي توزيع، لأن هذي فلوس مو حرة فعليًا. ${calcReason}`;
  return calcReason;
}

/**
 * خطوات محفوظة وما انأشّر عليها، بس الالتزام تغيّر بعدها:
 * انحذف، أو صار الناقص منه أقل من مبلغ الخطوة (تعدّل، أو تغطّى من مصدر ثاني).
 */
export function staleSteps(steps: Step[], done: Record<string, boolean>, reserves: Reserve[], source: string): Step[] {
  return steps.filter((s) => {
    if (!s.reserveId || done?.[s.id]) return false;
    const r = reserves.find((x) => x.id === s.reserveId);
    return !r || s.amount > Math.max(0, r.amount - committedOf(r, source)) + 0.005;
  });
}

/** كم ينحسب فعلًا لو أشّر على خطوة التزام الآن (ما يتجاوز الناقص منه) */
export function creditFor(step: Step, reserves: Reserve[], source: string): number | null {
  if (!step.reserveId) return null;
  const r = reserves.find((x) => x.id === step.reserveId);
  if (!r) return 0;
  return Math.min(step.amount, Math.max(0, r.amount - savedOf(r, source)));
}

export function buildMonthPlan(
  input: Profile & { surplus: number },
  reserves: Reserve[],
  planKey: string,
  locked: Record<string, number> = {}
): MonthPlan {
  const res = reservesForMonth(reserves, input.surplus, planKey, locked);
  const free = Math.round((input.surplus - res.reserved) * 100) / 100;
  // نحسب حالة الطوارئ حتى لو ما بقى شي حر (1 ريال رمزي)، ونصفّر المبالغ بعدها
  const calc = calculatePlan({ ...input, surplus: free > 0 ? free : 1 });
  const capped = capDebt(free > 0 ? calc.amounts : { ...ZERO }, input);
  const allocation = capped.amounts;

  const steps = makeSteps(res.items, allocation);

  const reason = planReason(res.reserved, free, calc.reason + capped.note);

  return {
    reservedItems: res.items,
    reserved: res.reserved,
    shortfall: res.shortfall,
    free: Math.max(0, free),
    calc,
    allocation,
    steps,
    reason,
  };
}

/**
 * عند إعادة حفظ نفس الشهر: الخطوة تبقى "منفذة" فقط لو نفس المبلغ.
 * لو تغيّر المبلغ لازم يأكد من جديد إنه حوّل المبلغ الجديد.
 */
export function carryDone(
  oldSteps: Step[] | null | undefined,
  oldDone: Record<string, boolean> | null | undefined,
  newSteps: Step[]
): Record<string, boolean> {
  const done: Record<string, boolean> = {};
  for (const s of newSteps) {
    const o = oldSteps?.find((x) => x.id === s.id);
    if (o && o.amount === s.amount && oldDone?.[s.id]) done[s.id] = true;
  }
  return done;
}

/** يسد نقص الفلوس المحجوزة من مبلغ، الأقدم موعدًا أول */
export function fillReserveGaps(amount: number, reserves: Reserve[]) {
  const gaps = reserves
    .map((r) => ({ reserve: r, gap: Math.max(0, r.amount - committedOf(r)) }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => a.reserve.dueKey.localeCompare(b.reserve.dueKey));
  let available = amount;
  return gaps
    .map((x) => {
      const take = Math.min(x.gap, available);
      available -= take;
      return { ...x, take };
    })
    .filter((x) => x.take > 0);
}

// ───────────── وصلني مبلغ ─────────────
// المستخدم يختار: يوزّع المبلغ بنفس نسب خطة الشهر، أو خطة جديدة لهذا المبلغ.

export type WindfallMode = 'plan' | 'new';

export interface WindfallFill {
  reserve: Reserve;
  gap: number;
  take: number;
}

export interface WindfallSplit {
  filled: WindfallFill[];
  reserved: number;
  free: number;
  amounts: Allocation | null; // null لو ما نعرف وضع المستخدم (ما حفظ خطة بعد)
  reason: string;
}

/** أقل ما نحتاجه من خطة محفوظة عشان نكرر نسبها */
export interface PlanShape {
  surplus: number;
  steps: Step[];
  allocation: Allocation;
}

/** وين يروح أي مبلغ زايد عن حاجة بند — نفس قاعدة الحاسبة */
const overflowTarget = (p: Profile): 'debt' | 'goal' | 'invest' =>
  p.debt === 'high' ? 'debt' : p.goal === 'near' ? 'goal' : 'invest';

/** خطة جديدة لهذا المبلغ: نسد نقص الفلوس المحجوزة كامل أولًا، والباقي بمنطق الحاسبة */
export function splitWindfallNew(amount: number, reserves: Reserve[], profile: Profile | null): WindfallSplit {
  const filled = fillReserveGaps(amount, reserves);
  const reserved = filled.reduce((a, x) => a + x.take, 0);
  const free = Math.max(0, Math.round((amount - reserved) * 100) / 100);
  const calc = free > 0 && profile ? calculatePlan({ ...profile, surplus: free }) : null;
  const capped = calc && profile ? capDebt(calc.amounts, profile) : null;
  const reason =
    (filled.length
      ? `قبل ما تصرف أي شي من المبلغ، سدّينا ${fmt(reserved)} ريال من التزاماتك القادمة عشان ما تنصدم فيها لاحقًا. `
      : RESERVES_ENABLED ? 'التزاماتك القادمة مغطاة، فوزّعنا المبلغ كامل. ' : '') + (calc?.reason ?? '') + (capped?.note ?? '');
  return { filled, reserved, free, amounts: capped?.amounts ?? null, reason };
}

/** حصة كل التزام من المبلغ بنفس نسبته في الخطة، بدون ما تتجاوز الناقص منه فعلًا */
export function planReserveTakes(amount: number, plan: PlanShape, reserves: Reserve[]): WindfallFill[] {
  const step = amount >= 1000 ? 10 : 1;
  const fills = plan.steps
    .filter((s) => s.reserveId)
    .map((s) => {
      const reserve = reserves.find((r) => r.id === s.reserveId);
      if (!reserve) return null; // التزام انحذف بعد حفظ الخطة
      const gap = Math.max(0, reserve.amount - committedOf(reserve));
      const want = Math.round((amount * s.amount) / plan.surplus / step) * step;
      return { reserve, gap, take: Math.min(want, gap) };
    })
    .filter((x): x is WindfallFill => !!x && x.take > 0);

  // التقريب ممكن يخلي المجموع يزيد عن المبلغ نفسه (مبلغ فيه هللات): ننقص من أكبر حصة
  let over = Math.round((fills.reduce((a, x) => a + x.take, 0) - amount) * 100) / 100;
  for (const f of [...fills].sort((a, b) => b.take - a.take)) {
    if (over <= 0) break;
    const cut = Math.min(f.take, over);
    f.take = Math.round((f.take - cut) * 100) / 100;
    over = Math.round((over - cut) * 100) / 100;
  }
  return fills.filter((x) => x.take > 0);
}

/**
 * نفس خطة الشهر: كل بند ياخذ من المبلغ نفس نسبته في الخطة المحفوظة.
 * الالتزام ما ياخذ أكثر من الناقص منه، والطوارئ ما تتجاوز هدف 6 أشهر؛
 * والزايد يتوزع على باقي البنود بنفس نسبها بينها (مو على بند واحد).
 */
export function splitWindfallByPlan(amount: number, plan: PlanShape, reserves: Reserve[], profile: Profile): WindfallSplit {
  const step = amount >= 1000 ? 10 : 1;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const filled = planReserveTakes(amount, plan, reserves);
  const reserved = r2(filled.reduce((a, x) => a + x.take, 0));
  const free = Math.max(0, r2(amount - reserved));

  const keys: (keyof Allocation)[] = ['emergency', 'debt', 'goal', 'invest', 'personal'];
  const amounts: Allocation = { emergency: 0, debt: 0, goal: 0, invest: 0, personal: 0 };
  const w = (k: keyof Allocation) => Math.max(0, plan.allocation[k] ?? 0);
  const room = Math.max(0, r2(profile.essential * 6 - profile.emergency));

  let active = keys.filter((k) => w(k) > 0);
  let left = free;
  let emergencyCut = 0;
  const sumW = () => active.reduce((a, k) => a + w(k), 0);

  // الطوارئ أول: لو حصتها تتجاوز الناقص عن الهدف، تاخذ الناقص فقط والباقي يرجع للتوزيع
  if (active.includes('emergency')) {
    const share = (free * w('emergency')) / sumW();
    if (share > room) {
      amounts.emergency = room;
      emergencyCut = share - room;
      left = r2(free - room);
      active = active.filter((k) => k !== 'emergency');
    }
  }
  const total = sumW();
  for (const k of active) amounts[k] = Math.round((left * w(k)) / total / step) * step;
  if (active.includes('emergency')) amounts.emergency = Math.min(amounts.emergency, room);

  // فرق التقريب (أو كل الباقي لو ما فيه بنود حرة في الخطة) يروح لأكبر بند غير الطوارئ
  const others = active.filter((k) => k !== 'emergency').sort((a, b) => amounts[b] - amounts[a]);
  let diff = r2(free - keys.reduce((a, k) => a + amounts[k], 0));
  if (diff > 0) {
    amounts[others[0] ?? overflowTarget(profile)] += diff;
  } else if (diff < 0) {
    for (const k of [...keys].sort((a, b) => amounts[b] - amounts[a])) {
      const cut = Math.min(amounts[k], -diff);
      amounts[k] = r2(amounts[k] - cut);
      diff = r2(diff + cut);
      if (diff >= 0) break;
    }
  }
  keys.forEach((k) => { amounts[k] = r2(amounts[k]); });

  // كم كان مفروض يروح للالتزامات حسب نسب الخطة، وما راح لأنها قاربت تكتمل
  const plannedReserved = plan.steps.filter((s) => s.reserveId).reduce((a, s) => a + (amount * s.amount) / plan.surplus, 0);
  const extra = Math.round(Math.max(0, plannedReserved - reserved) + emergencyCut);
  let reason = 'وزّعنا المبلغ بنفس نسب خطتك المحفوظة، فكل بند أخذ نفس حصته.';
  if (extra > step) {
    reason += ` بعض البنود ما تحتاج حصتها كاملة (${RESERVES_ENABLED ? 'التزام قارب يكتمل، أو ' : ''}الطوارئ قاربت هدفها)، فوزّعنا الزايد (${fmt(extra)} ريال) على باقي البنود بنفس نسبها.`;
  }
  const capped = capDebt(amounts, profile);
  return { filled, reserved, free, amounts: capped.amounts, reason: reason + capped.note };
}

/** نقطة دخول واحدة للوضعين — تستخدمها الواجهة للمعاينة والخادم عند الحفظ، فالنتيجة متطابقة */
export function splitWindfall(
  amount: number,
  mode: WindfallMode,
  ctx: { reserves: Reserve[]; profile: Profile | null; plan: PlanShape | null; goal?: Goal | null }
): WindfallSplit {
  if (mode === 'plan' && ctx.plan && ctx.profile) return splitWindfallByPlan(amount, ctx.plan, ctx.reserves, ctx.profile);
  return splitWindfallNew(amount, ctx.reserves, ctx.profile ? { ...ctx.profile, goal: ctx.goal ?? ctx.profile.goal } : null);
}
