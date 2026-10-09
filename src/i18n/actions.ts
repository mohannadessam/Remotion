"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, locales } from "./config";
import { createClient } from "@/lib/supabase/server";

const schema = z.enum(locales);

export async function setLocale(value: string) {
  const locale = schema.parse(value);
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Remember the preference on the profile too (used for notifications later).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }
}
