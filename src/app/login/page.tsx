import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { getCurrentProfile, homeForRole, safeNextPath } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo/mode";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const profile = await getCurrentProfile();
  if (profile) redirect(safeNextPath(next, homeForRole(profile.role)));

  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <Logo label={t("common.appName")} />
        <LocaleSwitcher />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div>
          <p className="mb-2 text-muted-foreground">{t("common.tagline")}</p>
          <h1 className="text-3xl">{t("auth.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("auth.subtitle")}</p>
        </div>
        <LoginForm next={safeNextPath(next, "")} />
        {process.env.NEXT_PUBLIC_SHOW_DEMO_HINT === "true" || DEMO_MODE ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{t("auth.demoHint")}</p>
        ) : null}
      </div>
    </main>
  );
}
