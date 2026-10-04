// مفاتيح الأشهر بصيغة "YYYY-MM-01" — تُبنى من مكوّنات التاريخ المحلية مباشرة.
// لا تستخدم toISOString() لهذا الغرض: يحوّل للتوقيت العالمي فيرجع يومًا للخلف
// في المناطق شرق غرينتش (السعودية UTC+3): أول سبتمبر يصير "2026-08-31".

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTH_NAMES_AR_SHORT = [
  'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون',
  'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس',
];

export function monthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** مفتاح الشهر السابق لمفتاح معطى */
export function previousMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
}

/** مفتاح بعد إضافة n شهر (n قد تكون سالبة) */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}

/** أقرب موعد قادم لشهر (1-12) ابتداءً من شهر مرجعي — الشهر نفسه يُعتبر قادمًا */
export function nextDueKey(dueMonth: number, fromKey: string): string {
  const [y, m] = fromKey.split('-').map(Number);
  return `${dueMonth >= m ? y : y + 1}-${String(dueMonth).padStart(2, '0')}-01`;
}

export const isMonthKey = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(s);

/** فرق الأشهر بين مفتاحين (b - a) */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  return style === 'long'
    ? `${MONTH_NAMES_AR[m - 1]} ${y}`
    : `${MONTH_NAMES_AR_SHORT[m - 1]} ${String(y).slice(2)}`;
}
