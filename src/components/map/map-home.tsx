"use client";

import { ChevronDown, ChevronUp, LocateFixed } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CrowdBadge } from "@/components/crowd-badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useLiveTrucks, type NearbyTruck } from "@/hooks/use-live-trucks";
import { displayCrowd } from "@/lib/crowd";
import { cuisineEmoji } from "@/lib/cuisine";
import { HAS_INTERACTIVE_MAP } from "@/lib/env";
import { localized } from "@/lib/format";
import { formatDistance, RIYADH_CENTER, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { StaticTruckMap } from "./static-truck-map";

// MapLibre touches `window`, so it only loads in the browser.
const TruckMap = dynamic(() => import("./truck-map").then((m) => m.TruckMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-muted" />,
});

type LocationState = { status: "locating" | "granted" | "denied"; position: LatLng | null };

export function MapHome() {
  const t = useTranslations();
  const locale = useLocale();
  const [location, setLocation] = useState<LocationState>({ status: "locating", position: null });
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off capability check
      setLocation({ status: "denied", position: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ status: "granted", position: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => setLocation({ status: "denied", position: null }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const center = location.position ?? (location.status === "denied" ? RIYADH_CENTER : null);
  const { trucks, loaded, live } = useLiveTrucks(center, onlyOnline);

  const labelFor = useCallback(
    (truck: NearbyTruck) =>
      `${localized(truck, locale)}، ${t(`crowd.${displayCrowd(truck)}`)}، ${formatDistance(truck.distance_m, locale)}`,
    [locale, t],
  );

  function select(id: string) {
    setSelectedId(id);
    setExpanded(true);
    requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-truck-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }

  return (
    <div className="relative h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] overflow-hidden">
      {center && !HAS_INTERACTIVE_MAP ? (
        <StaticTruckMap
          center={center}
          userLocation={location.position}
          trucks={trucks}
          selectedId={selectedId}
          onSelect={select}
          labelFor={labelFor}
          ariaLabel={t("map.mapLabel")}
          youAreHereLabel={t("map.youAreHere")}
          note={t("map.staticMap")}
        />
      ) : center ? (
        <TruckMap
          center={center}
          userLocation={location.position}
          trucks={trucks}
          selectedId={selectedId}
          onSelect={select}
          labelFor={labelFor}
          ariaLabel={t("map.mapLabel")}
          youAreHereLabel={t("map.youAreHere")}
          recenterSignal={recenterSignal}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground">{t("map.locating")}</div>
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="pointer-events-auto rounded-full bg-card/95 px-3 py-1 shadow-sm">
            <Logo label={t("common.appName")} />
          </div>
          <LocaleSwitcher className="pointer-events-auto" />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={onlyOnline}
            onClick={() => setOnlyOnline((v) => !v)}
            className={cn(
              "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm",
              onlyOnline ? "border-success bg-success text-white" : "bg-card text-foreground",
            )}
          >
            <span aria-hidden className={cn("size-2 rounded-full", onlyOnline ? "bg-white" : "bg-crowd-empty")} />
            {t("map.openNow")}
          </button>
          <span
            className="pointer-events-auto rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm"
            data-testid="realtime-status"
            data-live={live}
          >
            {live ? `● ${t("map.liveUpdates")}` : t("map.polling")}
          </span>
        </div>
        {location.status === "denied" ? (
          <p role="status" className="pointer-events-auto self-start rounded-lg bg-card/95 px-3 py-2 text-sm shadow-sm">
            {t("map.locationDenied")}
          </p>
        ) : null}
      </header>

      {location.position && HAS_INTERACTIVE_MAP ? (
        <Button
          variant="outline"
          size="icon"
          className="absolute end-3 bottom-[calc(var(--sheet-h)+0.75rem)] z-20 rounded-full shadow-md"
          style={{ "--sheet-h": expanded ? "45dvh" : "8.5rem" } as React.CSSProperties}
          aria-label={t("map.recenter")}
          onClick={() => setRecenterSignal((n) => n + 1)}
        >
          <LocateFixed />
        </Button>
      ) : null}

      {/* Bottom sheet */}
      <section
        aria-labelledby="nearby-heading"
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-card shadow-[0_-4px_24px_rgb(0_0_0/0.12)] transition-[height] duration-300",
          expanded ? "h-[45dvh]" : "h-[8.5rem]",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="truck-list"
          className="flex min-h-12 w-full flex-col items-center gap-1 px-4 pt-2"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
          <span className="flex w-full items-center justify-between">
            <h1 id="nearby-heading" className="text-base">
              {loaded ? t("map.nearbyCount", { count: trucks.length }) : t("common.loading")}
            </h1>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {expanded ? t("map.hideList") : t("map.showList")}
              {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
            </span>
          </span>
        </button>

        {loaded && trucks.length === 0 ? (
          <p className="px-4 py-2 text-sm text-muted-foreground">{t("map.noTrucks")}</p>
        ) : null}

        <ul id="truck-list" ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {trucks.map((truck) => (
            <li key={truck.id} data-truck-id={truck.id}>
              <Link
                href={`/truck/${truck.id}`}
                data-testid="truck-row"
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted",
                  selectedId === truck.id && "bg-accent",
                )}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-2xl" aria-hidden>
                  {cuisineEmoji(truck.cuisine)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{localized(truck, locale)}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {t(`cuisine.${truck.cuisine}`)} · {t("map.away", { distance: formatDistance(truck.distance_m, locale) })}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <CrowdBadge level={displayCrowd(truck)} />
                  {truck.is_online ? (
                    <span className="text-xs text-muted-foreground" data-testid="wait">
                      {truck.est_wait_minutes > 0 ? t("map.wait", { minutes: truck.est_wait_minutes }) : t("map.noWait")}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
