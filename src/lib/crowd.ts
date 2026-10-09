import type { Database } from "@/lib/database.types";

export type CrowdLevel = Database["public"]["Enums"]["crowd_level"];

export const CROWD_COLORS: Record<CrowdLevel | "offline", string> = {
  empty: "#639922",
  moderate: "#C98A28",
  busy: "#993C1D",
  offline: "#8A8A85",
};

/** Mirrors public.crowd_level_for() for client-side previews; the DB is the source of truth. */
export function crowdLevelFor(
  activeOrders: number,
  thresholds: { emptyMax: number; moderateMax: number } = { emptyMax: 3, moderateMax: 8 },
): CrowdLevel {
  if (activeOrders <= thresholds.emptyMax) return "empty";
  if (activeOrders <= thresholds.moderateMax) return "moderate";
  return "busy";
}

/** Mirrors the est_wait_minutes trigger: active_orders * avg_prep_minutes / parallelism, rounded up. */
export function estimatedWaitMinutes(activeOrders: number, avgPrepMinutes: number, parallelism: number) {
  return Math.ceil((activeOrders * avgPrepMinutes) / Math.max(1, parallelism));
}

export function displayCrowd(truck: { is_online: boolean; crowd_status: CrowdLevel }): CrowdLevel | "offline" {
  return truck.is_online ? truck.crowd_status : "offline";
}
