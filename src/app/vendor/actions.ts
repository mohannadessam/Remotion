"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorKey, invalid, type ActionResult } from "@/lib/action-result";
import { getVendorContext } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo/mode";
import * as demo from "@/lib/demo/store";
import { SUPABASE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  crowdModeSchema,
  latLngSchema,
  menuItemSchema,
  setOnlineSchema,
  truckProfileSchema,
  vendorApplicationSchema,
} from "@/lib/validation";

// In demo mode only the live controls (online, GPS, crowd, availability) change state.
const DEMO_READ_ONLY = { ok: false, error: "demoReadOnly" } as const;

async function vendorTruck() {
  const ctx = await getVendorContext();
  if (!ctx.vendor || !ctx.truck) return null;
  return { ...ctx, vendor: ctx.vendor, truck: ctx.truck };
}

/** Only accept image URLs from our own public bucket, inside the uploader's folder. */
function isOwnImage(url: string | null, bucket: string, userId: string) {
  return url === null || url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/${userId}/`);
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
export async function applyAsVendor(input: z.input<typeof vendorApplicationSchema>): Promise<ActionResult> {
  const parsed = vendorApplicationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (DEMO_MODE) return DEMO_READ_ONLY;

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_as_vendor", {
    p_business_name: parsed.data.businessName,
    p_cr_number: parsed.data.crNumber,
    p_municipality_license_no: parsed.data.municipalityLicenseNo,
  });
  if (error) {
    const key = dbErrorKey(error);
    return key === "duplicate_cr" ? { ok: false, error: key, fieldErrors: { crNumber: key } } : { ok: false, error: key };
  }
  revalidatePath("/", "layout");
  redirect("/vendor");
}

// ---------------------------------------------------------------------------
// Truck profile
// ---------------------------------------------------------------------------
export async function saveTruck(input: z.input<typeof truckProfileSchema>): Promise<ActionResult> {
  const parsed = truckProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (DEMO_MODE) return DEMO_READ_ONLY;

  const ctx = await getVendorContext();
  if (!ctx.vendor) return { ok: false, error: "forbidden" };
  if (!isOwnImage(parsed.data.logoUrl, "truck-logos", ctx.profile.id)) return { ok: false, error: "invalidInput" };

  const d = parsed.data;
  const values = {
    name_ar: d.nameAr,
    name_en: d.nameEn,
    cuisine: d.cuisine,
    description_ar: d.descriptionAr,
    description_en: d.descriptionEn,
    logo_url: d.logoUrl,
    avg_prep_minutes: d.avgPrepMinutes,
    parallelism: d.parallelism,
    slot_capacity: d.slotCapacity,
    delivery_enabled: d.deliveryEnabled,
    delivery_radius_m: d.deliveryRadiusM,
    delivery_fee: d.deliveryFee,
  };

  const supabase = await createClient();
  const { error } = ctx.truck
    ? await supabase.from("trucks").update(values).eq("id", ctx.truck.id)
    : await supabase.from("trucks").insert({ ...values, vendor_id: ctx.vendor.id });
  if (error) return { ok: false, error: dbErrorKey(error) };

  revalidatePath("/vendor", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Live state: online toggle, GPS, crowd mode
// ---------------------------------------------------------------------------
export async function setOnline(input: z.input<typeof setOnlineSchema>): Promise<ActionResult> {
  const parsed = setOnlineSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (parsed.data.online && ctx.vendor.status !== "approved") return { ok: false, error: "vendor_not_approved" };
  if (DEMO_MODE) {
    const d = parsed.data;
    const error = demo.setOnline(ctx.truck.id, d.online, d.online ? { lat: d.lat, lng: d.lng } : undefined);
    revalidatePath("/vendor");
    return error ? { ok: false, error } : { ok: true };
  }

  const supabase = await createClient();
  if (parsed.data.online) {
    // Location first: the trucks trigger refuses going online without one.
    const { error: locError } = await supabase.rpc("update_truck_location", {
      p_truck_id: ctx.truck.id,
      p_lat: parsed.data.lat,
      p_lng: parsed.data.lng,
    });
    if (locError) return { ok: false, error: dbErrorKey(locError) };
  }
  const { error } = await supabase.from("trucks").update({ is_online: parsed.data.online }).eq("id", ctx.truck.id);
  if (error) return { ok: false, error: dbErrorKey(error) };

  revalidatePath("/vendor");
  return { ok: true };
}

export async function updateLocation(input: z.input<typeof latLngSchema>): Promise<ActionResult> {
  const parsed = latLngSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (DEMO_MODE) {
    demo.updateLocation(ctx.truck.id, parsed.data);
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_truck_location", {
    p_truck_id: ctx.truck.id,
    p_lat: parsed.data.lat,
    p_lng: parsed.data.lng,
  });
  return error ? { ok: false, error: dbErrorKey(error) } : { ok: true };
}

export async function setCrowdMode(input: z.input<typeof crowdModeSchema>): Promise<ActionResult> {
  const parsed = crowdModeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (DEMO_MODE) {
    demo.setCrowdMode(ctx.truck.id, parsed.data.mode, parsed.data.mode === "manual" ? parsed.data.level : null);
    revalidatePath("/vendor");
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("trucks")
    .update(
      parsed.data.mode === "manual"
        ? { crowd_mode: "manual", manual_crowd: parsed.data.level }
        : { crowd_mode: "auto", manual_crowd: null },
    )
    .eq("id", ctx.truck.id);
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/vendor");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Menu CRUD
// ---------------------------------------------------------------------------
export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (DEMO_MODE) return DEMO_READ_ONLY;
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const values = { name_ar: parsed.data.nameAr, name_en: parsed.data.nameEn, sort_order: parsed.data.sortOrder };
  const { data, error } = parsed.data.id
    ? await supabase
        .from("menu_categories")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("truck_id", ctx.truck.id)
        .select("id")
        .single()
    : await supabase
        .from("menu_categories")
        .insert({ ...values, truck_id: ctx.truck.id })
        .select("id")
        .single();
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/vendor/menu");
  return { ok: true, data: { id: data.id } };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return invalid(parsedId.error);
  if (DEMO_MODE) return DEMO_READ_ONLY;
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("menu_categories").delete().eq("id", parsedId.data).eq("truck_id", ctx.truck.id);
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/vendor/menu");
  return { ok: true };
}

export async function saveMenuItem(input: z.input<typeof menuItemSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (DEMO_MODE) return DEMO_READ_ONLY;
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (!isOwnImage(parsed.data.imageUrl, "menu-images", ctx.profile.id)) {
    return { ok: false, error: "invalidInput", fieldErrors: { imageUrl: "invalidInput" } };
  }

  const d = parsed.data;
  const values = {
    category_id: d.categoryId,
    name_ar: d.nameAr,
    name_en: d.nameEn,
    description_ar: d.descriptionAr,
    description_en: d.descriptionEn,
    price: d.price,
    prep_minutes: d.prepMinutes,
    is_available: d.isAvailable,
    image_url: d.imageUrl,
  };

  const supabase = await createClient();
  const { data, error } = d.id
    ? await supabase.from("menu_items").update(values).eq("id", d.id).eq("truck_id", ctx.truck.id).select("id").single()
    : await supabase
        .from("menu_items")
        .insert({ ...values, truck_id: ctx.truck.id })
        .select("id")
        .single();
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/vendor/menu");
  return { ok: true, data: { id: data.id } };
}

export async function setItemAvailability(id: string, isAvailable: boolean): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), isAvailable: z.boolean() }).safeParse({ id, isAvailable });
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (DEMO_MODE) {
    demo.setItemAvailability(ctx.truck.id, parsed.data.id, parsed.data.isAvailable);
    revalidatePath("/vendor/menu");
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: parsed.data.isAvailable })
    .eq("id", parsed.data.id)
    .eq("truck_id", ctx.truck.id);
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/vendor/menu");
  return { ok: true };
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return invalid(parsedId.error);
  if (DEMO_MODE) return DEMO_READ_ONLY;
  const ctx = await vendorTruck();
  if (!ctx) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", parsedId.data).eq("truck_id", ctx.truck.id);
  if (error) return { ok: false, error: dbErrorKey(error) };
  revalidatePath("/vendor/menu");
  return { ok: true };
}
