// تقرير الشهر: يُرسم على canvas (المتصفح يشكّل الحروف العربية صح)، ويُصدَّر PNG أو PDF
// يحتوي نفس الصورة — بدون مكتبات خارجية. يُستخدم في المتصفح فقط.

import { fmt } from './calculator';
import { addMonths, monthLabel } from './month';
import { RESERVES_ENABLED } from './features';
import { savedOf, type Reserve, type Step } from './planner';
import { carriedDebt, carriedEmergency, type PlanRow, type WindfallRow } from './data';

export interface ReportData {
  month: string;
  label: string; // "تقرير الشهر" أو "خطة مبلغ"
  title: string;
  sub: string;
  stepsTitle: string;
  filename: string; // بدون الامتداد
  tiles: [string, number][];
  steps: Step[];
  done: Record<string, boolean>;
  doneN: number;
  emergencyAfter: number | null; // null في تقرير المبلغ
  emergencyGoal: number | null;
  personal: number;
  /** كم سدد من الدين وكم باقي (null لو ما سجّل دينه) */
  debt: { paid: number; left: number; start: number; paidLabel: string } | null;
  history: { month: string; surplus: number; emergency: number; done: number; total: number }[];
  reserves: { name: string; amount: number; saved: number; dueKey: string }[];
  windfalls: { source: string; amount: number; done: number; total: number }[]; // مبالغ وصلته في هذا الشهر
}

/** البطاقات الثلاث أعلى التقرير. بدون "فلوس محجوزة": المبلغ، كم تنفّذ منه، وكم باقي */
function tilesFor(label: string, total: number, reserved: number, steps: Step[], done: Record<string, boolean>): [string, number][] {
  if (RESERVES_ENABLED) return [[label, total], ['محجوز للالتزامات', reserved], ['موزّع على الخطة', total - reserved]];
  const all = steps.reduce((a, s) => a + s.amount, 0);
  const executed = steps.filter((s) => done[s.id]).reduce((a, s) => a + s.amount, 0);
  return [[label, total], ['نفّذت منه', executed], ['باقي تنفيذه', Math.round((all - executed) * 100) / 100]];
}

export function buildReportData(plans: PlanRow[], reserves: Reserve[], month: string, windfalls: WindfallRow[] = []): ReportData | null {
  const plan = plans.find((p) => p.month === month);
  if (!plan) return null;
  const steps = plan.steps ?? [];
  const doneN = steps.filter((s) => plan.done?.[s.id]).length;
  let streak = 1;
  for (let k = addMonths(month, -1); plans.some((p) => p.month === k); k = addMonths(k, -1)) streak++;
  const sub = [`نفّذت ${doneN} من ${steps.length} خطوات`];
  if (streak === 2) sub.push('شهرين متتاليين');
  else if (streak > 2) sub.push(streak <= 10 ? `${streak} أشهر متتالية` : `${streak} شهر متتالي`);
  // الدين: كم سدد هالشهر (دفعات إضافية مؤشّرة من الخطة والمبالغ) وكم باقي آخره
  const cd = carriedDebt(plan, windfalls, addMonths(month, 1));
  return {
    debt: cd && plan.debt_left != null ? { paid: cd.paid, left: cd.value, start: plan.debt_left, paidLabel: 'سددت هالشهر' } : null,
    month,
    label: 'تقرير الشهر',
    title: `خطة ${monthLabel(month)}`,
    sub: sub.join('  ·  '),
    stepsTitle: 'خطوات الشهر',
    filename: `فائض - تقرير ${monthLabel(month)}`,
    tiles: tilesFor('الفائض', plan.surplus, plan.reserved, steps, plan.done ?? {}),
    steps,
    done: plan.done ?? {},
    doneN,
    // رصيد آخر الشهر: أوله + حصة الخطة المؤكدة + حصص الطوارئ المؤكدة من مبالغ هذا الشهر
    emergencyAfter: carriedEmergency(plan, windfalls, addMonths(month, 1)).value,
    emergencyGoal: plan.essential * 6,
    personal: plan.allocation?.personal ?? 0,
    history: plans
      .filter((p) => p.month <= month)
      .slice(-6)
      .map((p) => ({
        month: p.month,
        surplus: p.surplus,
        emergency: p.emergency,
        done: (p.steps ?? []).filter((s) => p.done?.[s.id]).length,
        total: (p.steps ?? []).length,
      })),
    reserves: reserves
      .map((r) => ({ name: r.name, amount: r.amount, saved: Math.min(r.amount, savedOf(r)), dueKey: r.dueKey }))
      .sort((a, b) => a.dueKey.localeCompare(b.dueKey)),
    windfalls: windfalls
      .filter((w) => w.month === month)
      .map((w) => ({ source: w.source, amount: w.amount, done: w.steps.filter((x) => w.done?.[x.id]).length, total: w.steps.length }))
      .reverse(), // الأقدم أول
  };
}

/** تقرير مبلغ محفوظ: نفس شكل تقرير الشهر، بخطوات المبلغ وما نُفّذ منها */
export function buildWindfallReportData(windfalls: WindfallRow[], id: string, plans: PlanRow[] = []): ReportData | null {
  const w = windfalls.find((x) => x.id === id);
  if (!w) return null;
  const doneN = w.steps.filter((s) => w.done?.[s.id]).length;
  // الدين: كم سدد من هذا المبلغ (لو أشّر على خطوته) وكم باقي الآن
  const last = plans[plans.length - 1];
  const cur = last ? carriedDebt(last, windfalls) : null;
  const dStep = w.steps.find((s) => s.id === 'debt');
  const dPaid = dStep && w.done?.[dStep.id] ? dStep.amount : 0;
  return {
    debt: cur && (dStep || cur.value > 0) ? { paid: dPaid, left: cur.value, start: cur.value + dPaid, paidLabel: 'سددت من هذا المبلغ' } : null,
    month: w.month,
    label: 'خطة مبلغ',
    title: `${w.source} · ${fmt(w.amount)} ريال`,
    sub: [monthLabel(w.month), w.mode === 'plan' ? 'نفس خطة الشهر' : 'خطة جديدة', `نفّذت ${doneN} من ${w.steps.length} خطوات`].join('  ·  '),
    stepsTitle: 'خطوات المبلغ',
    filename: `فائض - ${w.source} ${fmt(w.amount)} - ${monthLabel(w.month)}`,
    tiles: tilesFor('المبلغ', w.amount, w.reserved, w.steps, w.done ?? {}),
    steps: w.steps,
    done: w.done ?? {},
    doneN,
    emergencyAfter: null,
    emergencyGoal: null,
    personal: w.allocation?.personal ?? 0,
    history: [],
    reserves: [],
    windfalls: [],
  };
}

const C = {
  bg: '#f7f6f2', card: '#ffffff', ink: '#171717', muted: '#6b6b66', line: '#e6e3da',
  accent: '#173f35', soft: '#dfece7', gold: '#b98b42', danger: '#9d3b35',
};
const F = (w: number, s: number) => `${w} ${s}px Tahoma, Arial, sans-serif`;
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type Ctx = CanvasRenderingContext2D | null;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** يرسم التقرير. لو ctx = null يحسب الارتفاع فقط. */
function drawReport(ctx: Ctx, d: ReportData, W: number): number {
  const M = 56, R = W - M, IW = W - 2 * M;
  let y = 0;
  const t = (s: string, x: number, yy: number, font: string, color: string, align: CanvasTextAlign = 'right', maxW?: number) => {
    if (!ctx) return;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    let str = s;
    if (maxW && ctx.measureText(str).width > maxW) {
      while (str.length > 1 && ctx.measureText(str + '…').width > maxW) str = str.slice(0, -1);
      str += '…';
    }
    ctx.fillText(str, x, yy);
  };
  const box = (x: number, yy: number, w: number, h: number, r: number, fill?: string | null, stroke?: string | null) => {
    if (!ctx) return;
    roundRectPath(ctx, x, yy, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };
  const bar = (x: number, yy: number, w: number, h: number, pct: number, color: string) => {
    box(x, yy, w, h, h / 2, C.line);
    const fw = Math.max(0, Math.min(1, pct)) * w;
    if (fw > 0) box(x + w - fw, yy, fw, h, h / 2, color); // يمتلئ من اليمين
  };
  const tick = (x: number, yy: number, s: number, done: boolean) => {
    box(x - s, yy, s, s, 7, done ? C.accent : C.card, done ? null : '#c9c5b9');
    if (!ctx || !done) return;
    ctx.beginPath();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.moveTo(x - s * 0.76, yy + s * 0.52); ctx.lineTo(x - s * 0.56, yy + s * 0.72); ctx.lineTo(x - s * 0.24, yy + s * 0.3);
    ctx.stroke();
  };
  const section = (title: string) => { y += 64; t(title, R, y, F(700, 30), C.ink); y += 26; };

  if (ctx) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 99999); ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, 12); }

  y = 86;
  t('فائض', R, y, F(800, 40), C.ink);
  if (ctx) { ctx.font = F(800, 40); t('.', R - ctx.measureText('فائض').width - 4, y, F(800, 40), C.gold); }
  t(d.label, M, y, F(400, 24), C.muted, 'left');
  y += 78;
  t(d.title, R, y, F(800, 54), C.ink, 'right', IW);
  y += 50;
  t(d.sub, R, y, F(400, 26), C.muted, 'right', IW);

  y += 40;
  const tiles = d.tiles;
  const gap = 16, tw = (IW - gap * 2) / 3, th = 132;
  tiles.forEach(([k, v], i) => {
    const x = R - (i + 1) * tw - i * gap;
    box(x, y, tw, th, 18, C.card, C.line);
    t(k, x + tw - 22, y + 44, F(400, 22), C.muted);
    t(fmt(v), x + tw - 22, y + 94, F(800, 38), C.ink);
    t('ريال', x + 22, y + 94, F(400, 20), C.muted, 'left');
  });
  y += th + 24;

  const half = (IW - gap) / 2, ch = 150;
  const execPct = d.steps.length ? d.doneN / d.steps.length : 0;
  const hasE = d.emergencyGoal !== null && d.emergencyAfter !== null;
  const ew = hasE ? half : IW; // تقرير المبلغ: بطاقة التنفيذ بعرض كامل
  box(R - ew, y, ew, ch, 18, C.card, C.line);
  t('نسبة التنفيذ', R - 22, y + 44, F(400, 22), C.muted);
  t(`${Math.round(execPct * 100)}%`, R - 22, y + 98, F(800, 44), C.accent);
  if (!hasE) t(`${d.doneN} من ${d.steps.length} خطوات`, M + 22, y + 98, F(400, 22), C.muted, 'left');
  bar(R - ew + 22, y + 118, ew - 44, 12, execPct, C.accent);
  if (d.emergencyGoal !== null && d.emergencyAfter !== null) {
    const ePct = d.emergencyGoal > 0 ? d.emergencyAfter / d.emergencyGoal : 0;
    box(M, y, half, ch, 18, C.card, C.line);
    t('صندوق الطوارئ بعد التنفيذ', M + half - 22, y + 44, F(400, 22), C.muted);
    t(`${fmt(d.emergencyAfter)} ريال`, M + half - 22, y + 98, F(800, 36), C.ink);
    t(`${Math.min(100, Math.round(ePct * 100))}% من ${fmt(d.emergencyGoal)}`, M + 22, y + 98, F(400, 20), C.muted, 'left');
    bar(M + 22, y + 118, half - 44, 12, ePct, C.accent);
  }
  y += ch;

  if (d.debt) {
    const dh = 150; y += 24;
    box(M, y, IW, dh, 18, C.card, C.line);
    t('الدين', R - 22, y + 44, F(400, 22), C.muted);
    t(`${d.debt.paidLabel} ${fmt(d.debt.paid)} ريال`, R - 22, y + 98, F(800, 34), C.accent, 'right', IW * 0.55);
    t(d.debt.left > 0 ? `باقي ${fmt(d.debt.left)} ريال` : 'انسدد كامل ✓', M + 22, y + 98, F(700, 28), d.debt.left > 0 ? C.ink : C.accent, 'left', IW * 0.38);
    bar(M + 22, y + 118, IW - 44, 12, d.debt.start > 0 ? (d.debt.start - d.debt.left) / d.debt.start : 1, C.accent);
    y += dh;
  }

  if (d.steps.length) {
    section(d.stepsTitle);
    d.steps.forEach((s) => {
      const done = !!d.done[s.id], rh = 64;
      y += 10;
      box(M, y, IW, rh, 14, done ? C.soft : C.card, done ? null : C.line);
      tick(R - 20, y + 16, 32, done);
      t(s.text, R - 70, y + 42, F(done ? 400 : 700, 24), done ? C.muted : C.ink, 'right', IW - 220);
      t(done ? 'تم' : 'لم يُنفّذ', M + 22, y + 42, F(700, 20), done ? C.accent : C.danger, 'left');
      y += rh;
    });
    if (d.personal > 0) { y += 40; t(`و${fmt(d.personal)} ريال إنفاق شخصي`, R, y, F(400, 22), C.muted); }
  }

  if (d.windfalls.length) {
    section('مبالغ وصلتك هذا الشهر');
    d.windfalls.forEach((w) => {
      const rh = 64; y += 10;
      const pct = w.total ? w.done / w.total : 0;
      box(M, y, IW, rh, 14, C.card, C.line);
      t(`${w.source} · ${fmt(w.amount)} ريال`, R - 22, y + 42, F(700, 24), C.ink, 'right', IW - 280);
      bar(M + 22, y + 26, 110, 12, pct, pct === 1 ? C.accent : C.gold);
      t(w.total ? `نُفّذ ${w.done}/${w.total}` : '—', M + 148, y + 40, F(700, 20), C.ink, 'left');
      y += rh;
    });
  }

  if (d.reserves.length) {
    section('الفلوس المحجوزة (حالتها اليوم)');
    d.reserves.forEach((r) => {
      const rh = 104; y += 10;
      box(M, y, IW, rh, 14, C.card, C.line);
      t(r.name, R - 22, y + 40, F(700, 25), C.ink, 'right', IW - 260);
      t(`يستحق ${monthLabel(r.dueKey)}`, M + 22, y + 40, F(400, 20), C.muted, 'left');
      bar(M + 22, y + 58, IW - 44, 12, r.amount ? r.saved / r.amount : 0, C.gold);
      t(`جاهز ${fmt(r.saved)} من ${fmt(r.amount)} ريال`, R - 22, y + 92, F(400, 20), C.muted);
      t(`${r.amount ? Math.round((r.saved / r.amount) * 100) : 0}%`, M + 22, y + 92, F(700, 20), C.gold, 'left');
      y += rh;
    });
  }

  if (d.history.length) {
    section('التتبّع');
    const cols = [R - 22, R - IW * 0.36, R - IW * 0.62, M + 22];
    y += 12;
    box(M, y, IW, 50 + d.history.length * 56, 14, C.card, C.line);
    t('الشهر', cols[0], y + 34, F(700, 20), C.muted);
    t('الفائض', cols[1], y + 34, F(700, 20), C.muted);
    t('الطوارئ', cols[2], y + 34, F(700, 20), C.muted);
    t('التنفيذ', cols[3], y + 34, F(700, 20), C.muted, 'left');
    y += 50;
    d.history.forEach((h) => {
      const cur = h.month === d.month;
      if (ctx) { ctx.fillStyle = C.line; ctx.fillRect(M + 12, y, IW - 24, 1); }
      t(monthLabel(h.month), cols[0], y + 36, F(cur ? 700 : 400, 22), C.ink);
      t(fmt(h.surplus), cols[1], y + 36, F(400, 22), C.ink);
      t(fmt(h.emergency), cols[2], y + 36, F(400, 22), C.ink);
      const pct = h.total ? h.done / h.total : 0;
      bar(M + 22, y + 24, 110, 12, pct, pct === 1 ? C.accent : C.gold);
      t(h.total ? `${h.done}/${h.total}` : '—', M + 148, y + 36, F(700, 20), C.ink, 'left');
      y += 56;
    });
  }

  y += 70;
  const today = new Date();
  t(`فائض PRO  ·  أُنشئ ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}  ·  أداة تعليمية وليست نصيحة استثمارية`, W / 2, y, F(400, 19), C.muted, 'center');
  return y + 50;
}

export function renderReportCanvas(d: ReportData): HTMLCanvasElement {
  const W = 1080, S = 2;
  const H = Math.ceil(drawReport(null, d, W));
  const c = document.createElement('canvas');
  c.width = W * S;
  c.height = H * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);
  ctx.direction = 'rtl';
  drawReport(ctx, d, W);
  return c;
}

/** PDF صفحة واحدة تحوي صورة JPEG */
export function jpegToPdf(jpeg: Uint8Array, imgW: number, imgH: number): Blob {
  const pageW = 595.28, pageH = +((pageW * imgH) / imgW).toFixed(2);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream');
  });
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xref = len;
  push('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map((n) => String(offsets[n]).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

export const canvasBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), type, q));

export async function reportFile(c: HTMLCanvasElement, kind: 'png' | 'pdf', base: string) {
  if (kind === 'png') return { filename: `${base}.png`, blob: await canvasBlob(c, 'image/png') };
  const jpeg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
  return { filename: `${base}.pdf`, blob: jpegToPdf(jpeg, c.width, c.height) };
}
