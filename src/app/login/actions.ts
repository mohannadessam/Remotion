"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { invalid, type ActionResult } from "@/lib/action-result";
import { homeForRole, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { phoneSchema, verifyOtpSchema } from "@/lib/validation";

export async function requestOtp(input: { phone: string }): Promise<ActionResult<{ phone: string }>> {
  const parsed = phoneSchema.safeParse(input.phone);
  if (!parsed.success) return { ok: false, error: "invalidPhone" };

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
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
