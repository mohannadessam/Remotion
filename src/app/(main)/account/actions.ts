"use server";

import { revalidatePath } from "next/cache";
import { invalid, type ActionResult } from "@/lib/action-result";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

export async function updateProfile(input: { fullName: string }): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", profile.id);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/account");
  return { ok: true };
}
