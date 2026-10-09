"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUpload } from "@/components/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatSar, localized } from "@/lib/format";
import {
  deleteCategory,
  deleteMenuItem,
  saveCategory,
  saveMenuItem,
  setItemAvailability,
} from "../actions";

type Category = { id: string; name_ar: string; name_en: string | null; sort_order: number };
type Item = {
  id: string;
  category_id: string | null;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  prep_minutes: number;
};

type ItemDraft = {
  id?: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: string;
  prepMinutes: string;
  isAvailable: boolean;
  imageUrl: string | null;
};

function toDraft(item: Item | null, defaultCategory: string): ItemDraft {
  return {
    id: item?.id,
    categoryId: item ? (item.category_id ?? "") : defaultCategory,
    nameAr: item?.name_ar ?? "",
    nameEn: item?.name_en ?? "",
    descriptionAr: item?.description_ar ?? "",
    descriptionEn: item?.description_en ?? "",
    price: item ? String(item.price) : "",
    prepMinutes: item ? String(item.prep_minutes) : "10",
    isAvailable: item?.is_available ?? true,
    imageUrl: item?.image_url ?? null,
  };
}

export function MenuManager({ userId, categories, items }: { userId: string; categories: Category[]; items: Item[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState({ nameAr: "", nameEn: "" });
  const [editingCategory, setEditingCategory] = useState<{ id: string; nameAr: string; nameEn: string } | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return setError(t(`errors.${res.error ?? "generic"}`));
      onSuccess?.();
      router.refresh();
    });
  }

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setDraftErrors({});
    setError(null);
    startTransition(async () => {
      const res = await saveMenuItem({ ...draft, categoryId: draft.categoryId || null });
      if (!res.ok) {
        setDraftErrors(res.fieldErrors ?? {});
        return setError(t(`errors.${res.error}`));
      }
      setDraft(null);
      router.refresh();
    });
  }

  const sections = [
    ...categories.map((c) => ({ id: c.id, title: localized(c, locale), items: items.filter((i) => i.category_id === c.id) })),
    { id: "", title: t("truck.uncategorized"), items: items.filter((i) => !i.category_id) },
  ].filter((s) => s.id !== "" || s.items.length > 0);

  const set = (key: keyof ItemDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((d) => (d ? { ...d, [key]: e.target.value } : d));
  const fieldError = (key: string) => (draftErrors[key] ? t("errors.invalidInput") : undefined);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      {/* Categories */}
      <Card className="self-start">
        <CardHeader>
          <CardTitle>{t("vendor.menu.categories")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {categories.map((c) =>
              editingCategory?.id === c.id ? (
                <li key={c.id}>
                  <form
                    className="flex flex-col gap-2 rounded-lg bg-muted p-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        () => saveCategory({ id: c.id, nameAr: editingCategory.nameAr, nameEn: editingCategory.nameEn, sortOrder: c.sort_order }),
                        () => setEditingCategory(null),
                      );
                    }}
                  >
                    <Input
                      aria-label={t("vendor.menu.categoryNameAr")}
                      value={editingCategory.nameAr}
                      onChange={(e) => setEditingCategory({ ...editingCategory, nameAr: e.target.value })}
                    />
                    <Input
                      aria-label={t("vendor.menu.categoryNameEn")}
                      dir="ltr"
                      value={editingCategory.nameEn}
                      onChange={(e) => setEditingCategory({ ...editingCategory, nameEn: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={pending}>
                        {t("common.save")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold">{localized(c, locale)}</span>
                  <span className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("common.edit")} ${localized(c, locale)}`}
                      onClick={() => setEditingCategory({ id: c.id, nameAr: c.name_ar, nameEn: c.name_en ?? "" })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("common.delete")} ${localized(c, locale)}`}
                      disabled={pending}
                      onClick={() => {
                        if (confirm(t("vendor.menu.deleteCategoryConfirm"))) run(() => deleteCategory(c.id));
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </li>
              ),
            )}
          </ul>
          <form
            className="flex flex-col gap-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => saveCategory({ ...newCategory, sortOrder: categories.length + 1 }),
                () => setNewCategory({ nameAr: "", nameEn: "" }),
              );
            }}
          >
            <Input
              aria-label={t("vendor.menu.categoryNameAr")}
              placeholder={t("vendor.menu.categoryNameAr")}
              value={newCategory.nameAr}
              onChange={(e) => setNewCategory({ ...newCategory, nameAr: e.target.value })}
            />
            <Input
              aria-label={t("vendor.menu.categoryNameEn")}
              placeholder={t("vendor.menu.categoryNameEn")}
              dir="ltr"
              value={newCategory.nameEn}
              onChange={(e) => setNewCategory({ ...newCategory, nameEn: e.target.value })}
            />
            <Button type="submit" variant="secondary" disabled={pending || !newCategory.nameAr.trim()}>
              <Plus aria-hidden />
              {t("vendor.menu.addCategory")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Items */}
      <div className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
            {error}
          </p>
        ) : null}

        {draft ? (
          <Card>
            <CardHeader>
              <CardTitle>{draft.id ? t("vendor.menu.editItem") : t("vendor.menu.addItem")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitDraft} noValidate>
                <Field label={t("vendor.menu.photo")} htmlFor="item-photo" className="sm:col-span-2">
                  <ImageUpload
                    bucket="menu-images"
                    userId={userId}
                    value={draft.imageUrl}
                    onChange={(imageUrl) => setDraft((d) => (d ? { ...d, imageUrl } : d))}
                    labels={{
                      add: t("common.add"),
                      change: t("vendor.menu.changePhoto"),
                      remove: t("vendor.menu.removePhoto"),
                      failed: t("vendor.menu.uploadFailed"),
                    }}
                  />
                </Field>
                <Field label={t("vendor.menu.itemNameAr")} htmlFor="item-nameAr" error={fieldError("nameAr")}>
                  <Input id="item-nameAr" value={draft.nameAr} onChange={set("nameAr")} maxLength={80} required />
                </Field>
                <Field label={t("vendor.menu.itemNameEn")} htmlFor="item-nameEn" error={fieldError("nameEn")}>
                  <Input id="item-nameEn" dir="ltr" value={draft.nameEn} onChange={set("nameEn")} maxLength={80} />
                </Field>
                <Field label={t("vendor.menu.price")} htmlFor="item-price" error={fieldError("price")}>
                  <Input
                    id="item-price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    value={draft.price}
                    onChange={set("price")}
                    required
                  />
                </Field>
                <Field label={t("vendor.menu.prepMinutes")} htmlFor="item-prep" error={fieldError("prepMinutes")}>
                  <Input
                    id="item-prep"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={180}
                    value={draft.prepMinutes}
                    onChange={set("prepMinutes")}
                  />
                </Field>
                <Field label={t("vendor.menu.category")} htmlFor="item-category" className="sm:col-span-2">
                  <NativeSelect id="item-category" value={draft.categoryId} onChange={set("categoryId")}>
                    <option value="">{t("vendor.menu.noCategory")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {localized(c, locale)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t("vendor.menu.descriptionAr")} htmlFor="item-descAr">
                  <Textarea id="item-descAr" value={draft.descriptionAr} onChange={set("descriptionAr")} maxLength={300} />
                </Field>
                <Field label={t("vendor.menu.descriptionEn")} htmlFor="item-descEn">
                  <Textarea
                    id="item-descEn"
                    dir="ltr"
                    value={draft.descriptionEn}
                    onChange={set("descriptionEn")}
                    maxLength={300}
                  />
                </Field>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="item-available"
                    checked={draft.isAvailable}
                    onCheckedChange={(isAvailable) => setDraft((d) => (d ? { ...d, isAvailable } : d))}
                  />
                  <label htmlFor="item-available" className="font-bold">
                    {t("vendor.menu.available")}
                  </label>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? t("common.saving") : t("common.save")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Button size="lg" className="self-start" onClick={() => setDraft(toDraft(null, categories[0]?.id ?? ""))}>
            <Plus aria-hidden />
            {t("vendor.menu.addItem")}
          </Button>
        )}

        {items.length === 0 && !draft ? <p className="text-muted-foreground">{t("vendor.menu.empty")}</p> : null}

        {sections.map((section) => (
          <section key={section.id || "none"} aria-label={section.title} className="flex flex-col gap-2">
            <h2 className="text-lg text-primary">{section.title}</h2>
            {section.items.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : null}
            <ul className="flex flex-col gap-2">
              {section.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-2" data-testid="vendor-menu-item">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {item.image_url ? <Image src={item.image_url} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{localized(item, locale)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSar(item.price, locale)} · {t("truck.prepTime", { minutes: item.prep_minutes })}
                      {!item.is_available ? (
                        <Badge variant="offline" className="ms-2">
                          {t("truck.unavailable")}
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <Switch
                    checked={item.is_available}
                    disabled={pending}
                    aria-label={`${t("vendor.menu.available")}: ${localized(item, locale)}`}
                    onCheckedChange={(checked) => run(() => setItemAvailability(item.id, checked))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("common.edit")} ${localized(item, locale)}`}
                    onClick={() => {
                      setDraftErrors({});
                      setDraft(toDraft(item, ""));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("common.delete")} ${localized(item, locale)}`}
                    disabled={pending}
                    onClick={() => {
                      if (confirm(t("vendor.menu.deleteItemConfirm"))) run(() => deleteMenuItem(item.id));
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
