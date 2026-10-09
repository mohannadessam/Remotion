"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { formatSaudiPhone } from "@/lib/phone";
import { requestOtp, verifyOtp } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestOtp({ phone: phoneInput });
      if (!res.ok) return setError(res.error);
      setPhone(res.data.phone);
      setCode("");
      setStep("code");
    });
  }

  function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // On success the action redirects; we only get a value back on failure.
      const res = await verifyOtp({ phone, token: code, next: next || undefined });
      if (res && !res.ok) setError(res.fieldErrors?.token ?? res.error);
    });
  }

  if (step === "phone") {
    return (
      <form onSubmit={onSendCode} className="flex flex-col gap-4" noValidate>
        <Field label={t("phoneLabel")} htmlFor="phone" error={error ? t(error) : undefined}>
          <div className="flex items-stretch gap-2" dir="ltr">
            <span className="flex min-h-11 items-center rounded-lg border border-input bg-muted px-3 font-bold">
              +966
            </span>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={t("phonePlaceholder")}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              aria-invalid={!!error}
              required
              autoFocus
              className="text-lg tracking-wider"
            />
          </div>
        </Field>
        <Button type="submit" size="lg" disabled={pending || !phoneInput.trim()}>
          {t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onVerify} className="flex flex-col gap-4" noValidate>
      <p className="text-muted-foreground">
        {t.rich("codeSentTo", {
          number: formatSaudiPhone(phone),
          phone: (chunks) => (
            <bdi dir="ltr" className="font-bold text-foreground">
              {chunks}
            </bdi>
          ),
        })}
      </p>
      <Field label={t("codeLabel")} htmlFor="code" error={error ? t(error) : undefined}>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={!!error}
          className="text-center text-2xl tracking-[0.5em]"
          autoFocus
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending || code.trim().length < 6}>
        {t("verify")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setStep("phone");
          setError(null);
        }}
      >
        {t("changeNumber")}
      </Button>
    </form>
  );
}
