import { LogOut, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/app/login/actions";
import { getCurrentProfile } from "@/lib/auth";
import { formatSaudiPhone } from "@/lib/phone";
import { ProfileForm } from "./profile-form";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const t = await getTranslations();
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t("account.title")}</h1>
        <LocaleSwitcher />
      </div>

      {!profile ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("account.signedOutTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground">{t("account.signedOutBody")}</p>
            <Button asChild size="lg">
              <Link href="/login?next=/account">{t("auth.signIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">{t("account.phone")}</dt>
                <dd className="font-bold" dir="ltr">
                  <bdi>{formatSaudiPhone(profile.phone)}</bdi>
                </dd>
                <dt className="text-muted-foreground">{t("account.role")}</dt>
                <dd className="font-bold" data-testid="profile-role">
                  {t(`account.roles.${profile.role}`)}
                </dd>
              </dl>
              <ProfileForm fullName={profile.full_name ?? ""} />
            </CardContent>
          </Card>

          {profile.role === "customer" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("account.haveTruck")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-muted-foreground">{t("account.haveTruckBody")}</p>
                <Button asChild variant="success">
                  <Link href="/vendor/apply">
                    <Truck aria-hidden />
                    {t("account.becomeVendor")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {profile.role === "vendor" ? (
            <Button asChild variant="outline">
              <Link href="/vendor">{t("account.goToDashboard")}</Link>
            </Button>
          ) : null}

          <form action={signOut}>
            <Button type="submit" variant="ghost" className="w-full text-destructive">
              <LogOut aria-hidden />
              {t("auth.signOut")}
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
