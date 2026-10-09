"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CUISINES } from "@/lib/format";
import type { TruckProfileInput } from "@/lib/validation";
import { saveTruck } from "../actions";

type Values = {
  nameAr: string;
  nameEn: string;
  cuisine: TruckProfileInput["cuisine"];
  descriptionAr: string;
  descriptionEn: string;
  logoUrl: string | null;
  avgPrepMinutes: number;
  parallelism: number;
  slotCapacity: number;
  deliveryEnabled: boolean;
  deliveryRadiusM: number;
  deliveryFee: number;
};

export function TruckForm({ initial, userId, isNew }: { initial: Values; userId: string; isNew: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const text = (key: keyof Values) => ({
    id: key,
    value: values[key] as string | number,
    "aria-invalid": !!errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  const err = (key: string) => (errors[key] ? t("errors.invalidInput") : undefined);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        setMessage(null);
        startTransition(async () => {
          const res = await saveTruck(values);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setMessage({ ok: false, text: t(`errors.${res.error}`) });
            return;
          }
          if (isNew) return router.push("/vendor/menu");
          setMessage({ ok: true, text: t("common.saved") });
          router.refresh();
        });
      }}
    >
      <Field label={t("vendor.fields.logo")} htmlFor="logo">
        <ImageUpload
          bucket="truck-logos"
          userId={userId}
          value={values.logoUrl}
          onChange={(logoUrl) => setValues((v) => ({ ...v, logoUrl }))}
          labels={{
            add: t("common.add"),
            change: t("vendor.menu.changePhoto"),
            remove: t("vendor.menu.removePhoto"),
            failed: t("vendor.menu.uploadFailed"),
          }}
        />
      </Field>
      <Field label={t("vendor.fields.nameAr")} htmlFor="nameAr" error={err("nameAr")}>
        <Input {...text("nameAr")} maxLength={80} required />
      </Field>
      <Field label={`${t("vendor.fields.nameEn")} (${t("common.optional")})`} htmlFor="nameEn" error={err("nameEn")}>
        <Input {...text("nameEn")} maxLength={80} dir="ltr" />
      </Field>
      <Field label={t("vendor.fields.cuisine")} htmlFor="cuisine" error={err("cuisine")}>
        <NativeSelect {...text("cuisine")}>
          {CUISINES.map((c) => (
            <option key={c} value={c}>
              {t(`cuisine.${c}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={`${t("vendor.fields.descriptionAr")} (${t("common.optional")})`} htmlFor="descriptionAr">
        <Textarea {...text("descriptionAr")} maxLength={500} />
      </Field>
      <Field label={`${t("vendor.fields.descriptionEn")} (${t("common.optional")})`} htmlFor="descriptionEn">
        <Textarea {...text("descriptionEn")} maxLength={500} dir="ltr" />
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 font-bold">{t("vendor.operationsSection")}</legend>
        <Field label={t("vendor.fields.avgPrepMinutes")} htmlFor="avgPrepMinutes" error={err("avgPrepMinutes")}>
          <Input {...text("avgPrepMinutes")} type="number" inputMode="numeric" min={1} max={180} />
        </Field>
        <Field label={t("vendor.fields.parallelism")} htmlFor="parallelism" error={err("parallelism")}>
          <Input {...text("parallelism")} type="number" inputMode="numeric" min={1} max={20} />
        </Field>
        <Field label={t("vendor.fields.slotCapacity")} htmlFor="slotCapacity" error={err("slotCapacity")}>
          <Input {...text("slotCapacity")} type="number" inputMode="numeric" min={1} max={100} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 font-bold">{t("vendor.deliverySection")}</legend>
        <div className="flex items-center justify-between">
          <label htmlFor="deliveryEnabled" className="font-bold">
            {t("vendor.fields.deliveryEnabled")}
          </label>
          <Switch
            id="deliveryEnabled"
            checked={values.deliveryEnabled}
            onCheckedChange={(deliveryEnabled) => setValues((v) => ({ ...v, deliveryEnabled }))}
          />
        </div>
        {values.deliveryEnabled ? (
          <>
            <Field label={t("vendor.fields.deliveryRadius")} htmlFor="deliveryRadiusM" error={err("deliveryRadiusM")}>
              <Input {...text("deliveryRadiusM")} type="number" inputMode="numeric" min={0} max={5000} step={100} />
            </Field>
            <Field label={t("vendor.fields.deliveryFee")} htmlFor="deliveryFee" error={err("deliveryFee")}>
              <Input {...text("deliveryFee")} type="number" inputMode="decimal" min={0} max={200} step={0.5} />
            </Field>
          </>
        ) : null}
      </fieldset>

      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-success" : "text-destructive"}>
          {message.text}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("common.saving") : isNew ? t("vendor.createTruck") : t("common.save")}
      </Button>
    </form>
  );
}
