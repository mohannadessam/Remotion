import { z } from "zod";
import { CUISINES } from "@/lib/format";
import { MAX_DELIVERY_RADIUS_M } from "@/lib/geo";
import { normalizeSaudiPhone, toAsciiDigits } from "@/lib/phone";

// Shared zod schemas. Server actions parse every mutation with these (CLAUDE.md §9);
// clients may reuse them for instant feedback. Error messages are i18n keys under "errors"/"auth".

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const asciiDigits = z.string().transform((v) => toAsciiDigits(v).trim());

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const normalized = normalizeSaudiPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return normalized;
  });

export const otpSchema = asciiDigits.pipe(z.string().regex(/^\d{6}$/, "invalidCode"));

export const verifyOtpSchema = z.object({ phone: phoneSchema, token: otpSchema });

export const vendorApplicationSchema = z.object({
  businessName: z.string().trim().min(2, "invalidInput").max(120, "invalidInput"),
  crNumber: asciiDigits.pipe(z.string().regex(/^\d{10}$/, "invalidCr")),
  municipalityLicenseNo: z
    .string()
    .trim()
    .transform((v) => toAsciiDigits(v).toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]{4,30}$/, "invalidLicense")),
});

export const truckProfileSchema = z.object({
  nameAr: z.string().trim().min(2).max(80),
  nameEn: optionalText(80),
  cuisine: z.enum(CUISINES),
  descriptionAr: optionalText(500),
  descriptionEn: optionalText(500),
  logoUrl: z.url().nullish().transform((v) => v ?? null),
  avgPrepMinutes: z.coerce.number().int().min(1).max(180),
  parallelism: z.coerce.number().int().min(1).max(20),
  slotCapacity: z.coerce.number().int().min(1).max(100),
  deliveryEnabled: z.boolean(),
  deliveryRadiusM: z.coerce.number().int().min(0).max(MAX_DELIVERY_RADIUS_M),
  deliveryFee: z.coerce.number().min(0).max(200).transform((v) => Math.round(v * 100) / 100),
});
export type TruckProfileInput = z.input<typeof truckProfileSchema>;

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const setOnlineSchema = z.discriminatedUnion("online", [
  z.object({ online: z.literal(true), lat: latLngSchema.shape.lat, lng: latLngSchema.shape.lng }),
  z.object({ online: z.literal(false) }),
]);

export const crowdModeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("auto") }),
  z.object({ mode: z.literal("manual"), level: z.enum(["empty", "moderate", "busy"]) }),
]);

export const categorySchema = z.object({
  id: z.uuid().optional(),
  nameAr: z.string().trim().min(1).max(60),
  nameEn: optionalText(60),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const menuItemSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid().nullish().transform((v) => v ?? null),
  nameAr: z.string().trim().min(1).max(80),
  nameEn: optionalText(80),
  descriptionAr: optionalText(300),
  descriptionEn: optionalText(300),
  price: z.coerce.number().min(0).max(10_000).transform((v) => Math.round(v * 100) / 100),
  prepMinutes: z.coerce.number().int().min(0).max(180),
  isAvailable: z.boolean(),
  imageUrl: z.url().nullish().transform((v) => v ?? null),
});
export type MenuItemInput = z.input<typeof menuItemSchema>;

export const profileSchema = z.object({
  fullName: optionalText(80),
});
