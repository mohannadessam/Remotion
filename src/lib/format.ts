/** Intl locale for numbers: Latin digits in both languages for consistency (see docs/decisions.md). */
export function numberLocale(locale: string) {
  return locale === "ar" ? "ar-SA-u-nu-latn" : "en-SA";
}

export function formatSar(amount: number, locale: string) {
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** Picks the localized name, falling back to Arabic (always present). */
export function localized<T extends { name_ar: string; name_en?: string | null }>(row: T, locale: string) {
  return locale === "en" && row.name_en ? row.name_en : row.name_ar;
}

export function localizedDescription(
  row: { description_ar?: string | null; description_en?: string | null },
  locale: string,
) {
  return (locale === "en" && row.description_en) || row.description_ar || row.description_en || null;
}

export const CUISINES = [
  "burgers",
  "shawarma",
  "coffee",
  "desserts",
  "mandi",
  "tacos",
  "breakfast",
  "pizza",
  "juice",
  "grill",
  "other",
] as const;
