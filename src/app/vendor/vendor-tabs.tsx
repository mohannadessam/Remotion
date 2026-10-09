"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function VendorTabs() {
  const t = useTranslations();
  const pathname = usePathname();
  const tabs = [
    { href: "/vendor", label: t("vendor.dashboardTitle") },
    { href: "/vendor/truck", label: t("vendor.truckProfile") },
    { href: "/vendor/menu", label: t("vendor.menuManager") },
  ];
  return (
    <nav aria-label={t("vendor.dashboardTitle")} className="mx-auto max-w-4xl overflow-x-auto px-2">
      <ul className="flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-4 font-bold whitespace-nowrap",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
