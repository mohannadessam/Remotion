"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { updateProfile } from "./actions";

export function ProfileForm({ fullName }: { fullName: string }) {
  const t = useTranslations();
  const [value, setValue] = useState(fullName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateProfile({ fullName: value });
          setMessage(res.ok ? t("common.saved") : t(`errors.${res.error}`));
        });
      }}
    >
      <Field label={t("account.fullName")} htmlFor="fullName" hint={message ?? undefined} className="flex-1">
        <Input
          id="fullName"
          value={value}
          maxLength={80}
          placeholder={t("account.fullNamePlaceholder")}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className={message ? "mb-6" : undefined}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
