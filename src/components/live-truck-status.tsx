"use client";

import { Clock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { CrowdBadge } from "@/components/crowd-badge";
import { displayCrowd, type CrowdLevel } from "@/lib/crowd";
import { createClient } from "@/lib/supabase/client";

type LiveState = {
  is_online: boolean;
  crowd_status: CrowdLevel;
  active_orders: number;
  est_wait_minutes: number;
};

const POLL_MS = 30_000;

/** Live crowd / wait / online for one truck: Realtime first, 30 s polling as fallback. */
export function LiveTruckStatus({ truckId, initial }: { truckId: string; initial: LiveState }) {
  const t = useTranslations();
  const [state, setState] = useState(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`truck-${truckId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trucks", filter: `id=eq.${truckId}` },
        (payload) => {
          const row = payload.new as LiveState;
          setState({
            is_online: row.is_online,
            crowd_status: row.crowd_status,
            active_orders: row.active_orders,
            est_wait_minutes: row.est_wait_minutes,
          });
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => void supabase.removeChannel(channel);
  }, [truckId]);

  useEffect(() => {
    if (live) return;
    const id = setInterval(async () => {
      const { data } = await createClient()
        .from("trucks")
        .select("is_online, crowd_status, active_orders, est_wait_minutes")
        .eq("id", truckId)
        .maybeSingle();
      if (data) setState(data);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [live, truckId]);

  const level = displayCrowd(state);
  return (
    <section
      aria-live="polite"
      aria-labelledby="live-status-heading"
      className="rounded-xl border bg-card p-4"
      data-testid="live-status"
    >
      <div className="flex items-center justify-between">
        <h2 id="live-status-heading" className="text-base">
          {t("truck.liveStatus")}
        </h2>
        <CrowdBadge level={level} className="text-sm" />
      </div>
      {state.is_online ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-muted-foreground">{t("truck.estimatedWait")}</dt>
              <dd className="font-bold" data-testid="est-wait">
                {state.est_wait_minutes > 0 ? t("common.minutes", { count: state.est_wait_minutes }) : t("map.noWait")}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-muted-foreground" aria-hidden />
            <dd className="font-bold" data-testid="active-orders">
              {t("truck.activeOrders", { count: state.active_orders })}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("truck.closedNow")}</p>
      )}
    </section>
  );
}
