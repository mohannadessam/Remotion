"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { applyAsVendor } from "../actions";

type Values = { businessName: string; crNumber: string; municipalityLicenseNo: string };

export function ApplicationForm({ initial }: { initial: Values }) {
  const t = useTranslations();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const res = await applyAsVendor(values);
          if (res && !res.ok) {
            setErrors(res.fieldErrors ?? {});
            if (!res.fieldErrors) setFormError(t(`errors.${res.error}`));
          }
        });
      }}
    >
      <Field label={t("vendor.businessName")} htmlFor="businessName" error={err("businessName")}>
        <Input id="businessName" value={values.businessName} onChange={set("businessName")} maxLength={120} required />
      </Field>
      <Field label={t("vendor.crNumber")} htmlFor="crNumber" hint={t("vendor.crNumberHint")} error={err("crNumber")}>
        <Input
          id="crNumber"
          inputMode="numeric"
          dir="ltr"
          value={values.crNumber}
          onChange={set("crNumber")}
          maxLength={10}
          required
        />
      </Field>
      <Field label={t("vendor.municipalityLicense")} htmlFor="municipalityLicenseNo" error={err("municipalityLicenseNo")}>
        <Input
          id="municipalityLicenseNo"
          dir="ltr"
          value={values.municipalityLicenseNo}
          onChange={set("municipalityLicenseNo")}
          maxLength={30}
          required
        />
      </Field>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("common.saving") : t("vendor.submitApplication")}
      </Button>
    </form>
  );
}
