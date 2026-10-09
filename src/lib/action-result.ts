import type { z } from "zod";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Flattens zod issues into { field: i18nKey } using each issue's message when it is a known key. */
export function invalid(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    fieldErrors[key] ??= /^[a-zA-Z_]+$/.test(issue.message) ? issue.message : "invalidInput";
  }
  return { ok: false, error: "invalidInput", fieldErrors };
}

/** Maps Postgres/PostgREST errors raised by our functions/triggers to i18n error keys. */
export function dbErrorKey(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "generic";
  const known = ["vendor_not_approved", "location_required", "vendor_already_reviewed"];
  if (error.message && known.includes(error.message)) return error.message;
  if (error.code === "23505" && error.message?.includes("cr_number")) return "duplicate_cr";
  if (error.code === "42501") return "forbidden";
  return "generic";
}
