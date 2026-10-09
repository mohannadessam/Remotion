import { numberLocale } from "@/lib/format";

export type LatLng = { lat: number; lng: number };

/** Central Riyadh, used when the customer's location is unavailable. */
export const RIYADH_CENTER: LatLng = { lat: 24.7136, lng: 46.6753 };
export const DEFAULT_RADIUS_M = 10_000;
export const MAX_DELIVERY_RADIUS_M = 5_000;

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formats a distance with locale-aware digits: 850 -> "850 m", 2345 -> "2.3 km". */
export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) {
    const value = Math.max(10, Math.round(meters / 10) * 10);
    return new Intl.NumberFormat(numberLocale(locale), { style: "unit", unit: "meter", unitDisplay: "short" }).format(value);
  }
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "unit",
    unit: "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: meters < 10_000 ? 1 : 0,
  }).format(meters / 1000);
}
