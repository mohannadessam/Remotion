import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getVendorContext } from "@/lib/auth";
import { ApplicationForm } from "./application-form";

export default async function VendorApplyPage() {
  const { profile, vendor } = await getVendorContext();
  if (profile.role === "admin") redirect("/");
  if (vendor && (vendor.status === "approved" || vendor.status === "suspended")) redirect("/vendor");

  const t = await getTranslations("vendor");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl">{t("onboardingTitle")}</h1>
      <p className="text-muted-foreground">{t("onboardingBody")}</p>
      <ApplicationForm
        initial={{
          businessName: vendor?.business_name ?? "",
          crNumber: vendor?.cr_number ?? "",
          municipalityLicenseNo: vendor?.municipality_license_no ?? "",
        }}
      />
    </div>
  );
}
