"use client";

import { LayoutDashboard, Map, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function BottomNav({ role }: { role: string | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const items = [
    { href: "/", label: t("map"), icon: Map, active: pathname === "/" || pathname.startsWith("/truck") },
    ...(role === "vendor"
      ? [{ href: "/vendor", label: t("vendor"), icon: LayoutDashboard, active: pathname.startsWith("/vendor") }]
      : []),
    { href: "/account", label: t("account"), icon: UserRound, active: pathname.startsWith("/account") },
  ];

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon, active }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
