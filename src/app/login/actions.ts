"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { invalid, type ActionResult } from "@/lib/action-result";
import { homeForRole, safeNextPath } from "@/lib/auth";
import { DEMO_MODE, DEMO_SESSION_COOKIE } from "@/lib/demo/mode";
import * as demo from "@/lib/demo/store";
import { createClient } from "@/lib/supabase/server";
import { phoneSchema, verifyOtpSchema } from "@/lib/validation";

export async function requestOtp(input: { phone: string }): Promise<ActionResult<{ phone: string }>> {
  const parsed = phoneSchema.safeParse(input.phone);
  if (!parsed.success) return { ok: false, error: "invalidPhone" };
  // Demo mode sends no SMS; the code is always 123456.
  if (DEMO_MODE) return { ok: true, data: { phone: parsed.data } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data,
    options: { channel: "sms", data: { locale: await getLocale() } },
  });
  if (error) {
    if (error.status === 429) return { ok: false, error: "tooManyRequests" };
    console.error("requestOtp failed", error.status, error.code);
    return { ok: false, error: "sendFailed" };
  }
  return { ok: true, data: { phone: parsed.data } };
}

export async function verifyOtp(input: { phone: string; token: string; next?: string }): Promise<ActionResult> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  if (DEMO_MODE) {
    if (parsed.data.token !== "123456") return { ok: false, error: "wrongCode" };
    const profile = demo.profileForPhone(parsed.data.phone);
    (await cookies()).set(DEMO_SESSION_COOKIE, profile.id, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(safeNextPath(input.next, homeForRole(profile.role)));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });
  if (error || !data.user) return { ok: false, error: "wrongCode" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(safeNextPath(input.next, homeForRole(profile?.role ?? "customer")));
}

export async function signOut() {
  if (DEMO_MODE) {
    (await cookies()).delete(DEMO_SESSION_COOKIE);
    redirect("/");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
