"use client";

import { MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setOnline, updateLocation } from "./actions";

const GPS_INTERVAL_MS = 15_000;

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000 }),
  );
}

/**
 * Online toggle. While online, this device's GPS position is pushed every 15 s
 * (latest fix from watchPosition), and a screen wake lock is requested when supported.
 */
export function OnlineControl({
  initialOnline,
  canGoOnline,
  lastLocationAt,
}: {
  initialOnline: boolean;
  canGoOnline: boolean;
  lastLocationAt: string | null;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [online, setOnlineState] = useState(initialOnline);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(lastLocationAt ? new Date(lastLocationAt) : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef<GeolocationCoordinates | null>(null);

  useEffect(() => {
    if (!online || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = pos.coords;
        setError(null);
      },
      // Transient failures (timeouts, no fix yet) are common on the road; only surface a real denial.
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setError("vendor.gpsDenied");
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    const timer = setInterval(async () => {
      const coords = latest.current;
      if (!coords) return;
      const res = await updateLocation({ lat: coords.latitude, lng: coords.longitude });
      if (res.ok) setLastUpdate(new Date());
    }, GPS_INTERVAL_MS);

    let wakeLock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((lock) => (wakeLock = lock))
      .catch(() => {});

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      void wakeLock?.release();
    };
  }, [online]);

  function toggle(next: boolean) {
    setError(null);
    startTransition(async () => {
      if (!next) {
        const res = await setOnline({ online: false });
        if (!res.ok) return setError(`errors.${res.error}`);
        setOnlineState(false);
        router.refresh();
        return;
      }
      if (!("geolocation" in navigator)) return setError("vendor.gpsUnavailable");
      let pos: GeolocationPosition;
      try {
        pos = await currentPosition();
      } catch {
        return setError("vendor.gpsDenied");
      }
      latest.current = pos.coords;
      const res = await setOnline({ online: true, lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (!res.ok) return setError(`errors.${res.error}`);
      setLastUpdate(new Date());
      setOnlineState(true);
      router.refresh();
    });
  }

  return (
    <Card className={online ? "border-success" : undefined}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          <label htmlFor="online-switch" className="cursor-pointer">
            {online ? t("vendor.online") : t("vendor.offline")}
          </label>
        </CardTitle>
        <Switch
          id="online-switch"
          checked={online}
          disabled={pending || (!online && !canGoOnline)}
          onCheckedChange={toggle}
          aria-label={online ? t("vendor.goOffline") : t("vendor.goOnline")}
          data-testid="online-switch"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">{t("vendor.onlineHint")}</p>
        {online ? (
          <p className="flex items-center gap-1 font-bold text-success">
            <MapPin className="size-4" aria-hidden />
            {t("vendor.gpsActive")} · {t("vendor.keepOpen")}
          </p>
        ) : null}
        {lastUpdate ? (
          <p className="text-muted-foreground">
            {t("vendor.lastUpdate", { time: format.dateTime(lastUpdate, { timeStyle: "short" }) })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive">
            {t(error)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
