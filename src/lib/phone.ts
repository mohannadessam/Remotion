const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic / Persian digits to ASCII digits. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : EASTERN_ARABIC_INDIC.indexOf(d));
  });
}

/**
 * Normalises a Saudi mobile number to E.164 (+9665XXXXXXXX).
 * Accepts 5XXXXXXXX, 05XXXXXXXX, 9665XXXXXXXX, +9665XXXXXXXX, 009665XXXXXXXX,
 * with spaces/dashes and Arabic-Indic digits. Returns null if it isn't a Saudi mobile.
 */
export function normalizeSaudiPhone(input: string): string | null {
  let digits = toAsciiDigits(input).replace(/[\s\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return /^5\d{8}$/.test(digits) ? `+966${digits}` : null;
}

/** +966500000001 -> 050 000 0001 (local display format). */
export function formatSaudiPhone(e164OrRaw: string | null | undefined): string {
  if (!e164OrRaw) return "";
  const normalized = normalizeSaudiPhone(e164OrRaw.startsWith("+") ? e164OrRaw : `+${e164OrRaw}`);
  if (!normalized) return e164OrRaw;
  const local = `0${normalized.slice(4)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
