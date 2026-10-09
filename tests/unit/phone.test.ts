import { describe, expect, it } from "vitest";
import { formatSaudiPhone, normalizeSaudiPhone } from "@/lib/phone";
import { phoneSchema } from "@/lib/validation";

describe("normalizeSaudiPhone", () => {
  it.each([
    ["0501234567", "+966501234567"],
    ["501234567", "+966501234567"],
    ["+966501234567", "+966501234567"],
    ["966501234567", "+966501234567"],
    ["00966501234567", "+966501234567"],
    ["050 123 4567", "+966501234567"],
    ["050-123-4567", "+966501234567"],
    ["٠٥٠١٢٣٤٥٦٧", "+966501234567"],
    ["۰۵۰۱۲۳۴۵۶۷", "+966501234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeSaudiPhone(input)).toBe(expected);
  });

  it.each(["0111234567", "05012345", "+971501234567", "abc", "", "0501234567890"])("rejects %s", (input) => {
    expect(normalizeSaudiPhone(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(formatSaudiPhone("966500000001")).toBe("050 000 0001");
    expect(formatSaudiPhone("+966500000001")).toBe("050 000 0001");
  });

  it("phoneSchema returns E.164 or an i18n error key", () => {
    expect(phoneSchema.parse("0500000001")).toBe("+966500000001");
    const bad = phoneSchema.safeParse("123");
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toBe("invalidPhone");
  });
});
