"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "@/lib/database.types";
import { DEMO_MODE } from "@/lib/demo/mode";
import { DEFAULT_RADIUS_M, distanceMeters, type LatLng } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";

export type NearbyTruck = Database["public"]["Functions"]["nearby_trucks"]["Returns"][number];
type TruckRow = Database["public"]["Tables"]["trucks"]["Row"];

const POLL_MS = 30_000;

function sortTrucks(list: NearbyTruck[]) {
  return [...list].sort((a, b) => Number(b.is_online) - Number(a.is_online) || a.distance_m - b.distance_m);
}

/**
 * Nearby trucks with live updates. Realtime row changes on `trucks` are patched in place;
 * if the Realtime channel isn't connected we poll every 30 s instead (CLAUDE.md §9).
 */
export function useLiveTrucks(center: LatLng | null, onlyOnline: boolean, radiusM = DEFAULT_RADIUS_M) {
  const [trucks, setTrucks] = useState<NearbyTruck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const params = useRef({ center, onlyOnline, radiusM });
  // Declared before the fetch effect so handlers always see the latest inputs.
  useEffect(() => {
    params.current = { center, onlyOnline, radiusM };
  });

  const refetch = useCallback(async () => {
    const { center: c, onlyOnline: online, radiusM: radius } = params.current;
    if (!c) return;
    if (DEMO_MODE) {
      const qs = new URLSearchParams({ lat: String(c.lat), lng: String(c.lng), radius: String(radius), online: String(online) });
      const res = await fetch(`/api/demo/trucks?${qs}`);
      if (res.ok) {
        setTrucks(await res.json());
        setLoaded(true);
      }
      return;
    }
    const { data, error } = await createClient().rpc("nearby_trucks", {
      p_lat: c.lat,
      p_lng: c.lng,
      p_radius_m: radius,
      p_only_online: online,
    });
    if (!error && data) {
      setTrucks(data);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch, center?.lat, center?.lng, onlyOnline, radiusM]);

  useEffect(() => {
    // Demo mode has no Realtime; the polling fallback below keeps the map fresh.
    if (DEMO_MODE) return;
    const supabase = createClient();
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => void refetch(), 300);
    };

    const channel = supabase
      .channel("trucks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trucks" }, (payload) => {
        if (payload.eventType !== "UPDATE") return scheduleRefetch();
        const row = payload.new as TruckRow;
        const { center: c, onlyOnline: online, radiusM: radius } = params.current;
        if (!c) return;

        setTrucks((current) => {
          const index = current.findIndex((t) => t.id === row.id);
          const distance =
            row.lat != null && row.lng != null ? distanceMeters(c, { lat: row.lat, lng: row.lng }) : Infinity;
          const qualifies = distance <= radius && !row.is_suspended && (!online || row.is_online);

          if (index === -1) {
            if (qualifies) scheduleRefetch();
            return current;
          }
          if (!qualifies) return current.filter((t) => t.id !== row.id);

          const next = [...current];
          next[index] = {
            ...current[index],
            name_ar: row.name_ar,
            name_en: row.name_en ?? current[index].name_en,
            cuisine: row.cuisine,
            logo_url: row.logo_url ?? current[index].logo_url,
            is_online: row.is_online,
            lat: row.lat ?? current[index].lat,
            lng: row.lng ?? current[index].lng,
            distance_m: distance,
            crowd_status: row.crowd_status,
            active_orders: row.active_orders,
            est_wait_minutes: row.est_wait_minutes,
            delivery_enabled: row.delivery_enabled,
            delivery_radius_m: row.delivery_radius_m,
          };
          return sortTrucks(next);
        });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      clearTimeout(refetchTimer);
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    if (live) return;
    const id = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(id);
  }, [live, refetch]);

  return { trucks, loaded, live, refetch };
}
