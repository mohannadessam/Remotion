import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LiveTruckStatus } from "@/components/live-truck-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVendor } from "@/lib/auth";
import { localized } from "@/lib/format";
import { getLocale } from "next-intl/server";
import { cn } from "@/lib/utils";
import { CrowdControl } from "./crowd-control";
import { OnlineControl } from "./online-control";

const STATUS_STYLE = {
  pending: "border-crowd-moderate bg-crowd-moderate/10",
  approved: "border-success bg-success/10",
  rejected: "border-destructive bg-destructive/10",
  suspended: "border-destructive bg-destructive/10",
} as const;

export default async function VendorDashboard() {
  const { vendor, truck } = await requireVendor();
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">{truck ? localized(truck, locale) : vendor.business_name}</h1>
        <span className="text-sm text-muted-foreground">{vendor.business_name}</span>
      </div>

      {vendor.status !== "approved" ? (
        <div role="status" className={cn("rounded-xl border p-4", STATUS_STYLE[vendor.status])} data-testid="vendor-status">
          <p className="font-bold">{t(`vendor.status.${vendor.status}`)}</p>
          {vendor.status === "rejected" && vendor.rejection_reason ? (
            <p className="mt-1 text-sm">{t("vendor.rejectionReason", { reason: vendor.rejection_reason })}</p>
          ) : null}
          {vendor.status === "pending" || vendor.status === "rejected" ? (
            <Button asChild variant="link" className="mt-1 px-0">
              <Link href="/vendor/apply">{t("vendor.editApplication")}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {!truck ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("vendor.noTruckTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground">{t("vendor.noTruckBody")}</p>
            <Button asChild size="lg">
              <Link href="/vendor/truck">{t("vendor.createTruck")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <OnlineControl
            initialOnline={truck.is_online}
            canGoOnline={vendor.status === "approved" && !truck.is_suspended}
            lastLocationAt={truck.location_updated_at}
          />
          <LiveTruckStatus
            truckId={truck.id}
            initial={{
              is_online: truck.is_online,
              crowd_status: truck.crowd_status,
              active_orders: truck.active_orders,
              est_wait_minutes: truck.est_wait_minutes,
            }}
          />
          <CrowdControl mode={truck.crowd_mode} manualLevel={truck.manual_crowd} />
        </div>
      )}
    </div>
  );
}
