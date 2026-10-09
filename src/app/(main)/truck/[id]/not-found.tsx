import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function TruckNotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <p className="text-5xl" aria-hidden>
        🚚
      </p>
      <h1 className="text-xl">{t("truck.notFound")}</h1>
      <Button asChild>
        <Link href="/">{t("nav.map")}</Link>
      </Button>
    </main>
  );
}
