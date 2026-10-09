import { ArrowRight, Bike, Star, Store } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LiveTruckStatus } from "@/components/live-truck-status";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { cuisineEmoji } from "@/lib/cuisine";
import { formatSar, localized, localizedDescription, numberLocale } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function getTruck(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const [{ data: truck }, { data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("trucks")
      .select(
        "id, name_ar, name_en, cuisine, description_ar, description_en, logo_url, is_online, crowd_status, active_orders, est_wait_minutes, delivery_enabled, delivery_radius_m, delivery_fee, rating_avg, rating_count",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("menu_categories").select("id, name_ar, name_en").eq("truck_id", id).order("sort_order"),
    supabase
      .from("menu_items")
      .select("id, category_id, name_ar, name_en, description_ar, description_en, price, image_url, is_available, prep_minutes")
      .eq("truck_id", id)
      .order("sort_order"),
  ]);
  if (!truck) return null;
  return { truck, categories: categories ?? [], items: items ?? [] };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await getTruck((await params).id);
  return { title: data ? localized(data.truck, await getLocale()) : undefined };
}

export default async function TruckPage({ params }: Params) {
  const { id } = await params;
  const data = await getTruck(id);
  if (!data) notFound();

  const { truck, categories, items } = data;
  const locale = await getLocale();
  const t = await getTranslations();

  const sections = [
    ...categories.map((c) => ({ id: c.id, title: localized(c, locale), items: items.filter((i) => i.category_id === c.id) })),
    {
      id: "uncategorized",
      title: t("truck.uncategorized"),
      items: items.filter((i) => !i.category_id || !categories.some((c) => c.id === i.category_id)),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <main className="mx-auto max-w-2xl">
      <div className="bg-primary px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-primary-foreground">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1 rounded-lg pe-3 font-bold">
            <ArrowRight className="size-5 ltr:rotate-180" aria-hidden />
            {t("nav.map")}
          </Link>
          <LocaleSwitcher className="text-foreground" />
        </div>
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-cream text-3xl">
            {truck.logo_url ? (
              <Image src={truck.logo_url} alt="" width={64} height={64} className="size-full object-cover" />
            ) : (
              <span aria-hidden>{cuisineEmoji(truck.cuisine)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl">{localized(truck, locale)}</h1>
            <p className="opacity-90">{t(`cuisine.${truck.cuisine}`)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {localizedDescription(truck, locale) ? <p>{localizedDescription(truck, locale)}</p> : null}

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary" className="text-sm">
            <Star className="size-4 fill-current text-crowd-moderate" aria-hidden />
            {truck.rating_count > 0
              ? `${new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 1 }).format(truck.rating_avg)} · `
              : ""}
            {t("truck.ratings", { count: truck.rating_count })}
          </Badge>
          {truck.delivery_enabled ? (
            <Badge variant="secondary" className="text-sm">
              <Bike className="size-4" aria-hidden />
              {t("truck.deliveryUpTo", { distance: formatDistance(truck.delivery_radius_m, locale) })} ·{" "}
              {t("truck.deliveryFee", { fee: formatSar(truck.delivery_fee, locale) })}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-sm">
              <Store className="size-4" aria-hidden />
              {t("truck.pickupOnly")}
            </Badge>
          )}
        </div>

        <LiveTruckStatus
          truckId={truck.id}
          initial={{
            is_online: truck.is_online,
            crowd_status: truck.crowd_status,
            active_orders: truck.active_orders,
            est_wait_minutes: truck.est_wait_minutes,
          }}
        />

        <h2 className="mt-2 text-xl">{t("truck.menu")}</h2>
        {sections.length === 0 ? <p className="text-muted-foreground">{t("truck.noMenu")}</p> : null}
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`cat-${section.id}`} className="flex flex-col gap-2">
            <h3 id={`cat-${section.id}`} className="text-lg text-primary">
              {section.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {section.items.map((item) => {
                const description = localizedDescription(item, locale);
                return (
                  <li
                    key={item.id}
                    data-testid="menu-item"
                    className={cn("flex gap-3 rounded-xl border bg-card p-3", !item.is_available && "opacity-60")}
                  >
                    <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-3xl">
                      {item.image_url ? (
                        <Image src={item.image_url} alt={localized(item, locale)} fill sizes="80px" className="object-cover" />
                      ) : (
                        <span aria-hidden>{cuisineEmoji(truck.cuisine)}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold">{localized(item, locale)}</h4>
                        <span className="shrink-0 font-bold text-primary">{formatSar(item.price, locale)}</span>
                      </div>
                      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
                      <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{t("truck.prepTime", { minutes: item.prep_minutes })}</span>
                        {!item.is_available ? <Badge variant="offline">{t("truck.unavailable")}</Badge> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="rounded-lg bg-secondary p-3 text-center text-sm">{t("truck.orderingSoon")}</p>
      </div>
    </main>
  );
}
