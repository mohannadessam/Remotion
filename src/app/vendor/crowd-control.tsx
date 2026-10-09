"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrowdLevel } from "@/lib/crowd";
import { cn } from "@/lib/utils";
import { setCrowdMode } from "./actions";

const LEVELS: CrowdLevel[] = ["empty", "moderate", "busy"];
const LEVEL_ACTIVE: Record<CrowdLevel, string> = {
  empty: "border-crowd-empty bg-crowd-empty/15 text-crowd-empty-ink",
  moderate: "border-crowd-moderate bg-crowd-moderate/20 text-crowd-moderate-ink",
  busy: "border-crowd-busy bg-crowd-busy/15 text-crowd-busy-ink",
};

export function CrowdControl({ mode, manualLevel }: { mode: "auto" | "manual"; manualLevel: CrowdLevel | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [current, setCurrent] = useState<{ mode: "auto" | "manual"; level: CrowdLevel | null }>({
    mode,
    level: manualLevel,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: { mode: "auto" } | { mode: "manual"; level: CrowdLevel }) {
    const previous = current;
    setCurrent({ mode: next.mode, level: next.mode === "manual" ? next.level : null });
    setError(null);
    startTransition(async () => {
      const res = await setCrowdMode(next);
      if (!res.ok) {
        setCurrent(previous);
        setError(t(`errors.${res.error}`));
      } else {
        router.refresh();
      }
    });
  }

  const optionClass = (active: boolean) =>
    cn(
      "flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 px-3 font-bold",
      active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card",
    );

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle id="crowd-title">{t("vendor.crowdTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div role="radiogroup" aria-labelledby="crowd-title" className="flex gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={current.mode === "auto"}
            disabled={pending}
            className={optionClass(current.mode === "auto")}
            onClick={() => save({ mode: "auto" })}
          >
            {t("vendor.crowdAuto")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={current.mode === "manual"}
            disabled={pending}
            className={optionClass(current.mode === "manual")}
            onClick={() => save({ mode: "manual", level: current.level ?? "moderate" })}
          >
            {t("vendor.crowdManual")}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {current.mode === "auto" ? t("vendor.crowdAutoHint") : t("vendor.crowdManualHint")}
        </p>
        {current.mode === "manual" ? (
          <div role="radiogroup" aria-label={t("crowd.legend")} className="flex gap-2">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={current.level === level}
                disabled={pending}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 px-2 font-bold",
                  current.level === level ? LEVEL_ACTIVE[level] : "border-border bg-card",
                )}
                onClick={() => save({ mode: "manual", level })}
              >
                {t(`crowd.${level}`)}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
