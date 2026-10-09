import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { requireProfile } from "@/lib/auth";
import { VendorTabs } from "./vendor-tabs";

export async function generateMetadata() {
  const t = await getTranslations("vendor");
  return { title: t("dashboardTitle") };
}

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile("/vendor");
  const t = await getTranslations();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/" aria-label={t("nav.map")}>
            <Logo label={t("common.appName")} />
          </Link>
          <LocaleSwitcher />
        </div>
        {profile.role === "vendor" ? <VendorTabs /> : null}
      </header>
      <main className="mx-auto max-w-4xl p-4">{children}</main>
    </div>
  );
}
