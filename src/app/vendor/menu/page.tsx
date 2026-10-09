import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MenuManager } from "./menu-manager";

export default async function MenuPage() {
  const { profile, truck } = await requireVendor();
  if (!truck) redirect("/vendor/truck");

  const supabase = await createClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("id, name_ar, name_en, sort_order").eq("truck_id", truck.id).order("sort_order"),
    supabase
      .from("menu_items")
      .select("id, category_id, name_ar, name_en, description_ar, description_en, price, image_url, is_available, prep_minutes")
      .eq("truck_id", truck.id)
      .order("sort_order")
      .order("created_at"),
  ]);

  const t = await getTranslations("vendor");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t("menuManager")}</h1>
      <MenuManager userId={profile.id} categories={categories ?? []} items={items ?? []} />
    </div>
  );
}
