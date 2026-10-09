import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireVendor } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo/mode";
import * as demo from "@/lib/demo/store";
import { createClient } from "@/lib/supabase/server";
import { MenuManager } from "./menu-manager";

export default async function MenuPage() {
  const { profile, truck } = await requireVendor();
  if (!truck) redirect("/vendor/truck");

  const { categories, items } = DEMO_MODE ? demo.truckMenu(truck.id) : await loadMenu(truck.id);

  const t = await getTranslations("vendor");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t("menuManager")}</h1>
      <MenuManager userId={profile.id} categories={categories} items={items} />
    </div>
  );
}

async function loadMenu(truckId: string) {
  const supabase = await createClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("id, name_ar, name_en, sort_order").eq("truck_id", truckId).order("sort_order"),
    supabase
      .from("menu_items")
      .select("id, category_id, name_ar, name_en, description_ar, description_en, price, image_url, is_available, prep_minutes")
      .eq("truck_id", truckId)
      .order("sort_order")
      .order("created_at"),
  ]);
  return { categories: categories ?? [], items: items ?? [] };
}
