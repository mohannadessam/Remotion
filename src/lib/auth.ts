import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEMO_MODE, DEMO_SESSION_COOKIE } from "@/lib/demo/mode";
import * as demo from "@/lib/demo/store";
import { createClient } from "@/lib/supabase/server";

/** Current user's profile, or null when signed out. Deduped per request. */
export const getCurrentProfile = cache(async () => {
  if (DEMO_MODE) {
    const id = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
    return id ? demo.getProfile(id) : null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, locale")
    .eq("id", userId)
    .maybeSingle();
  return profile;
});

/** Only allows same-origin relative paths, to avoid open redirects via ?next=. */
export function safeNextPath(next: unknown, fallback = "/"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}

export async function requireProfile(nextPath: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return profile;
}

export function homeForRole(role: string) {
  return role === "vendor" ? "/vendor" : "/";
}

/** For vendor pages: the signed-in vendor's application and (first) truck. */
export const getVendorContext = cache(async () => {
  const profile = await requireProfile("/vendor");
  if (DEMO_MODE) return { profile, ...demo.vendorContext(profile.id) };
  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name, cr_number, municipality_license_no, status, rejection_reason")
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!vendor) return { profile, vendor: null, truck: null };

  const { data: truck } = await supabase
    .from("trucks")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return { profile, vendor, truck };
});

export async function requireVendor() {
  const ctx = await getVendorContext();
  if (!ctx.vendor) redirect("/vendor/apply");
  return { ...ctx, vendor: ctx.vendor };
}
