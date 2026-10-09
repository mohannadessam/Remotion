"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CROWD_COLORS, displayCrowd } from "@/lib/crowd";
import { cuisineEmoji } from "@/lib/cuisine";
import type { LatLng } from "@/lib/geo";
import { MARKER_CLASS, USER_DOT_CLASS } from "./marker";
import type { TruckMapProps } from "./truck-map";

// Same framing as the MapLibre fitBounds: room for the header on top and the bottom sheet below.
const PAD = { top: 130, bottom: 170, side: 40 };
const MIN_SPAN_DEG = 0.01;

/** Fits the customer and trucks into the box with an equirectangular projection (fine at city scale). */
function fitView(points: LatLng[], width: number, height: number) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((Math.max(...lngs) - Math.min(...lngs)) * k, MIN_SPAN_DEG);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), MIN_SPAN_DEG);
  const usableW = Math.max(width - 2 * PAD.side, 1);
  const usableH = Math.max(height - PAD.top - PAD.bottom, 1);
  const scale = Math.min(usableW / spanX, usableH / spanY);
  const cx = PAD.side + usableW / 2;
  const cy = PAD.top + usableH / 2;
  return (p: LatLng) => ({ x: cx + (p.lng - midLng) * k * scale, y: cy - (p.lat - midLat) * scale });
}

/**
 * Keyless fallback for the map home: a static, non-pannable view with the same markers.
 * Used when neither NEXT_PUBLIC_MAPBOX_TOKEN nor NEXT_PUBLIC_MAP_STYLE_URL is set (e.g. DEMO_MODE).
 */
export function StaticTruckMap({
  center,
  userLocation,
  trucks,
  selectedId,
  onSelect,
  labelFor,
  ariaLabel,
  youAreHereLabel,
  note,
}: Omit<TruckMapProps, "recenterSignal"> & { note: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const project = useMemo(
    () => fitView([center, ...trucks.map((t) => ({ lat: t.lat, lng: t.lng }))], size.width, size.height),
    [center, trucks, size],
  );

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      dir="ltr"
      className="absolute inset-0 overflow-hidden bg-[#efe9df]"
      style={{
        backgroundImage:
          "linear-gradient(rgb(44 44 42 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(44 44 42 / 0.06) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      {size.width > 0 ? (
        <>
          {userLocation ? (
            <div
              role="img"
              aria-label={youAreHereLabel}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${USER_DOT_CLASS}`}
              style={{ left: project(userLocation).x, top: project(userLocation).y }}
            />
          ) : null}
          {trucks.map((truck) => {
            const { x, y } = project(truck);
            const level = displayCrowd(truck);
            const selected = truck.id === selectedId;
            return (
              <button
                key={truck.id}
                type="button"
                data-testid="truck-marker"
                data-truck-id={truck.id}
                data-level={level}
                data-selected={selected}
                aria-pressed={selected}
                aria-label={labelFor(truck)}
                onClick={() => onSelect(truck.id)}
                className={`absolute ${MARKER_CLASS}`}
                style={
                  {
                    left: x,
                    top: y,
                    translate: "-50% -100%",
                    "--marker-color": CROWD_COLORS[level],
                  } as React.CSSProperties
                }
              >
                <span className="text-lg leading-none">{cuisineEmoji(truck.cuisine)}</span>
                <span aria-hidden className="absolute -bottom-1 size-2 rotate-45 bg-[var(--marker-color)]" />
              </button>
            );
          })}
        </>
      ) : null}
      <p dir="auto" className="absolute start-3 bottom-[calc(8.5rem+0.75rem)] rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
        {note}
      </p>
    </div>
  );
}
