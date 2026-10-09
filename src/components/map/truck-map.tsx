"use client";

import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { NearbyTruck } from "@/hooks/use-live-trucks";
import { CROWD_COLORS, displayCrowd } from "@/lib/crowd";
import { cuisineEmoji } from "@/lib/cuisine";
import { MAP_STYLE_URL, MAPBOX_TOKEN } from "@/lib/env";
import type { LatLng } from "@/lib/geo";
import { MARKER_CLASS, MARKER_INNER_HTML, USER_DOT_CLASS } from "./marker";

// Mapbox raster tiles rendered by MapLibre (open-source Mapbox GL fork), or any MapLibre style
// from NEXT_PUBLIC_MAP_STYLE_URL. Without either, map-home renders StaticTruckMap instead.
function mapStyle(): string | StyleSpecification {
  if (MAP_STYLE_URL) return MAP_STYLE_URL;
  return {
    version: 8,
    sources: {
      mapbox: {
        type: "raster",
        tiles: [`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`],
        tileSize: 512,
        maxzoom: 20,
        attribution: "© Mapbox © OpenStreetMap",
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#efe9df" } },
      { id: "mapbox", type: "raster", source: "mapbox" },
    ],
  };
}

// Copied to public/ by scripts/copy-maplibre-worker.mjs (postinstall).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type TruckMapProps = {
  center: LatLng;
  userLocation: LatLng | null;
  trucks: NearbyTruck[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  labelFor: (truck: NearbyTruck) => string;
  ariaLabel: string;
  youAreHereLabel: string;
  recenterSignal: number;
};

function styleMarker(el: HTMLButtonElement, truck: NearbyTruck, selected: boolean, label: string) {
  const level = displayCrowd(truck);
  el.style.setProperty("--marker-color", CROWD_COLORS[level]);
  el.dataset.level = level;
  el.dataset.selected = String(selected);
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-pressed", String(selected));
  el.querySelector("[data-emoji]")!.textContent = cuisineEmoji(truck.cuisine);
}

export function TruckMap({
  center,
  userLocation,
  trucks,
  selectedId,
  onSelect,
  labelFor,
  ariaLabel,
  youAreHereLabel,
  recenterSignal,
}: TruckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const userMarkerRef = useRef<Marker | null>(null);
  const framed = useRef(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const markers = markersRef.current;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle(),
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    // Tile failures (offline, blocked CDN) shouldn't spam the console; markers still work without a basemap.
    let reportedTileError = false;
    map.on("error", (event) => {
      if (reportedTileError) return;
      reportedTileError = true;
      console.warn("Map tiles unavailable:", event.error?.message);
    });
    mapRef.current = map;
    framed.current = false;
    // Handle for e2e tests / debugging in development builds only.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __trukniMap?: MapLibreMap }).__trukniMap = map;
    return () => {
      markers.clear();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; center changes are handled below
  }, []);

  // Recenter when the user asks to (the initial view is handled by fitBounds below).
  useEffect(() => {
    if (recenterSignal > 0) mapRef.current?.easeTo({ center: [center.lng, center.lat], zoom: 13, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to explicit recenter requests
  }, [recenterSignal]);

  // First time trucks arrive, frame the customer plus the nearest trucks.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || framed.current || trucks.length === 0) return;
    framed.current = true;
    const bounds = new LngLatBounds([center.lng, center.lat], [center.lng, center.lat]);
    for (const truck of trucks.slice(0, 8)) bounds.extend([truck.lng, truck.lat]);
    map.fitBounds(bounds, { padding: { top: 130, bottom: 170, left: 40, right: 40 }, maxZoom: 14, duration: 0 });
  }, [trucks, center.lat, center.lng]);

  // "You are here" dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = USER_DOT_CLASS;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", youAreHereLabel);
      userMarkerRef.current = new Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, youAreHereLabel]);

  // Sync truck markers (add / move / recolor / remove).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const truck of trucks) {
      seen.add(truck.id);
      const selected = truck.id === selectedId;
      let marker = markers.get(truck.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.dataset.truckId = truck.id;
        el.dataset.testid = "truck-marker";
        el.className = MARKER_CLASS;
        el.innerHTML = MARKER_INNER_HTML;
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(truck.id);
        });
        marker = new Marker({ element: el, anchor: "bottom" }).setLngLat([truck.lng, truck.lat]).addTo(map);
        markers.set(truck.id, marker);
      } else {
        marker.setLngLat([truck.lng, truck.lat]);
      }
      styleMarker(marker.getElement() as HTMLButtonElement, truck, selected, labelFor(truck));
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [trucks, selectedId, labelFor]);

  // MapLibre's unlayered CSS sets `position: relative` on its container, which beats Tailwind's layered
  // utilities, so the positioning lives on a wrapper and MapLibre gets a plain full-size child.
  return (
    <div className="absolute inset-0" role="region" aria-label={ariaLabel}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
