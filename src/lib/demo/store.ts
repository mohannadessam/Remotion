import "server-only";
import { crowdLevelFor, estimatedWaitMinutes, type CrowdLevel } from "@/lib/crowd";
import type { Database } from "@/lib/database.types";
import { distanceMeters } from "@/lib/geo";
import fixtures from "./fixtures.json";

// DEMO_MODE data source: an in-memory copy of the seed (src/lib/demo/fixtures.json, exported by
// scripts/export-demo-fixtures.mjs). It mirrors the database rules that matter for the demo:
// crowd/wait recompute, public visibility, and "online only when approved". Changes live in
// server memory and reset on restart.

type Tables = Database["public"]["Tables"];
type TruckRow = Tables["trucks"]["Row"];
type NearbyTruck = Database["public"]["Functions"]["nearby_trucks"]["Returns"][number];

type DemoProfile = Pick<Tables["profiles"]["Row"], "id" | "role" | "full_name" | "phone" | "locale">;
type DemoVendor = Pick<
  Tables["vendors"]["Row"],
  "id" | "owner_id" | "business_name" | "cr_number" | "municipality_license_no" | "status" | "rejection_reason"
>;
type DemoTruck = Omit<TruckRow, "location" | "created_at" | "updated_at" | "location_updated_at"> & {
  location_updated_at: string | null;
};
type DemoCategory = Pick<Tables["menu_categories"]["Row"], "id" | "truck_id" | "name_ar" | "name_en" | "sort_order">;
type DemoItem = Pick<
  Tables["menu_items"]["Row"],
  | "id"
  | "truck_id"
  | "category_id"
  | "name_ar"
  | "name_en"
  | "description_ar"
  | "description_en"
  | "price"
  | "image_url"
  | "is_available"
  | "prep_minutes"
  | "sort_order"
>;

type State = {
  profiles: DemoProfile[];
  vendors: DemoVendor[];
  trucks: DemoTruck[];
  categories: DemoCategory[];
  items: DemoItem[];
  thresholds: { emptyMax: number; moderateMax: number };
};

function initialState(): State {
  const f = structuredClone(fixtures);
  return {
    profiles: f.profiles as DemoProfile[],
    vendors: f.vendors as DemoVendor[],
    trucks: (f.trucks as Omit<DemoTruck, "location_updated_at">[]).map((t) => ({ ...t, location_updated_at: null })),
    categories: f.categories as DemoCategory[],
    items: f.items as DemoItem[],
    thresholds: { emptyMax: f.settings.crowd_empty_max, moderateMax: f.settings.crowd_moderate_max },
  };
}

// globalThis keeps one store across dev hot reloads and between route handlers and server actions.
const holder = globalThis as unknown as { __trukniDemo?: State };
const state = () => (holder.__trukniDemo ??= initialState());

function recompute(truck: DemoTruck) {
  truck.crowd_status =
    truck.crowd_mode === "manual" && truck.manual_crowd
      ? truck.manual_crowd
      : crowdLevelFor(truck.active_orders, state().thresholds);
  truck.est_wait_minutes = estimatedWaitMinutes(truck.active_orders, truck.avg_prep_minutes, truck.parallelism);
}

function vendorOf(truck: DemoTruck) {
  return state().vendors.find((v) => v.id === truck.vendor_id);
}

function isPublic(truck: DemoTruck) {
  return vendorOf(truck)?.status === "approved" && !truck.is_suspended;
}

function publicTruck(id: string) {
  const truck = state().trucks.find((t) => t.id === id);
  return truck && isPublic(truck) ? truck : null;
}

function toRow(truck: DemoTruck): TruckRow {
  const now = new Date().toISOString();
  return { ...truck, location: null, created_at: now, updated_at: now };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export function nearbyTrucks(lat: number, lng: number, radiusM: number, onlyOnline: boolean): NearbyTruck[] {
  const radius = Math.min(Math.max(radiusM, 100), 50_000);
  return state()
    .trucks.filter((t) => isPublic(t) && (!onlyOnline || t.is_online) && t.lat != null && t.lng != null)
    .map((t) => ({ t, distance: distanceMeters({ lat, lng }, { lat: t.lat!, lng: t.lng! }) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => Number(b.t.is_online) - Number(a.t.is_online) || a.distance - b.distance)
    .map(({ t, distance }) => ({
      id: t.id,
      name_ar: t.name_ar,
      name_en: t.name_en ?? "",
      cuisine: t.cuisine,
      logo_url: t.logo_url ?? "",
      is_online: t.is_online,
      lat: t.lat!,
      lng: t.lng!,
      distance_m: distance,
      crowd_status: t.crowd_status,
      active_orders: t.active_orders,
      est_wait_minutes: t.est_wait_minutes,
      delivery_enabled: t.delivery_enabled,
      delivery_radius_m: t.delivery_radius_m,
      rating_avg: t.rating_avg,
      rating_count: t.rating_count,
    }));
}

export function truckLiveState(id: string) {
  const t = publicTruck(id);
  return t
    ? { is_online: t.is_online, crowd_status: t.crowd_status, active_orders: t.active_orders, est_wait_minutes: t.est_wait_minutes }
    : null;
}

/** Truck page data, same visibility rule as RLS: only approved, unsuspended trucks. */
export function truckDetail(id: string) {
  const truck = publicTruck(id);
  if (!truck) return null;
  return { truck: toRow(truck), ...truckMenu(id) };
}

export function truckMenu(truckId: string) {
  const s = state();
  return {
    categories: s.categories.filter((c) => c.truck_id === truckId).sort((a, b) => a.sort_order - b.sort_order),
    items: s.items.filter((i) => i.truck_id === truckId).sort((a, b) => a.sort_order - b.sort_order),
  };
}

export function getProfile(id: string) {
  return state().profiles.find((p) => p.id === id) ?? null;
}

/** Demo sign-in: seeded numbers map to their profile; any other valid number becomes a new customer. */
export function profileForPhone(e164: string) {
  const s = state();
  let profile = s.profiles.find((p) => p.phone === e164);
  if (!profile) {
    profile = { id: crypto.randomUUID(), role: "customer", full_name: null, phone: e164, locale: "ar" };
    s.profiles.push(profile);
  }
  return profile;
}

export function vendorContext(profileId: string) {
  const s = state();
  const vendor = s.vendors.find((v) => v.owner_id === profileId) ?? null;
  const truck = vendor ? s.trucks.find((t) => t.vendor_id === vendor.id) : undefined;
  return { vendor, truck: truck ? toRow(truck) : null };
}

// ---------------------------------------------------------------------------
// Writes (only the live-state controls; other edits are read-only in demo mode)
// ---------------------------------------------------------------------------
function ownedTruck(truckId: string) {
  const truck = state().trucks.find((t) => t.id === truckId);
  if (!truck) throw new Error("truck_not_found");
  return truck;
}

export function setOnline(truckId: string, online: boolean, position?: { lat: number; lng: number }) {
  const truck = ownedTruck(truckId);
  if (online && (vendorOf(truck)?.status !== "approved" || truck.is_suspended)) return "vendor_not_approved";
  if (position) updateLocation(truckId, position);
  truck.is_online = online;
  return null;
}

export function updateLocation(truckId: string, position: { lat: number; lng: number }) {
  const truck = ownedTruck(truckId);
  truck.lat = position.lat;
  truck.lng = position.lng;
  truck.location_updated_at = new Date().toISOString();
}

export function setCrowdMode(truckId: string, mode: "auto" | "manual", level: CrowdLevel | null) {
  const truck = ownedTruck(truckId);
  truck.crowd_mode = mode;
  truck.manual_crowd = mode === "manual" ? level : null;
  recompute(truck);
}

export function setItemAvailability(truckId: string, itemId: string, isAvailable: boolean) {
  const item = state().items.find((i) => i.id === itemId && i.truck_id === truckId);
  if (item) item.is_available = isAvailable;
}

export function setProfileName(profileId: string, fullName: string | null) {
  const profile = getProfile(profileId);
  if (profile) profile.full_name = fullName;
}
