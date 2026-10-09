import { getTranslations } from "next-intl/server";
import { requireVendor } from "@/lib/auth";
import { TruckForm } from "./truck-form";

export default async function TruckProfilePage() {
  const { profile, truck } = await requireVendor();
  const t = await getTranslations("vendor");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl">{truck ? t("truckProfile") : t("createTruck")}</h1>
      <TruckForm
        userId={profile.id}
        isNew={!truck}
        initial={{
          nameAr: truck?.name_ar ?? "",
          nameEn: truck?.name_en ?? "",
          cuisine: (truck?.cuisine as "other") ?? "other",
          descriptionAr: truck?.description_ar ?? "",
          descriptionEn: truck?.description_en ?? "",
          logoUrl: truck?.logo_url ?? null,
          avgPrepMinutes: truck?.avg_prep_minutes ?? 10,
          parallelism: truck?.parallelism ?? 2,
          slotCapacity: truck?.slot_capacity ?? 6,
          deliveryEnabled: truck?.delivery_enabled ?? false,
          deliveryRadiusM: truck?.delivery_radius_m ?? 3000,
          deliveryFee: truck?.delivery_fee ?? 0,
        }}
      />
    </div>
  );
}
