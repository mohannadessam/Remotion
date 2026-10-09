import { describe, expect, it } from "vitest";
import * as demo from "@/lib/demo/store";

// The demo store must follow the same rules as the database (RLS + triggers).
const HARA = "20000000-0000-4000-8000-000000000001";
const SAMRA = "20000000-0000-4000-8000-000000000004";
const PENDING = "20000000-0000-4000-8000-000000000007";
const RIYADH = { lat: 24.7136, lng: 46.6753 };

describe("demo store", () => {
  it("serves the seeded trucks with their crowd states and hides the pending vendor", () => {
    const trucks = demo.nearbyTrucks(RIYADH.lat, RIYADH.lng, 10_000, false);
    expect(trucks.map((t) => t.id)).not.toContain(PENDING);
    expect(trucks).toHaveLength(6);
    expect(trucks.find((t) => t.id === HARA)).toMatchObject({ crowd_status: "busy", est_wait_minutes: 40 });
    expect(demo.truckDetail(PENDING)).toBeNull();
    expect(demo.nearbyTrucks(RIYADH.lat, RIYADH.lng, 10_000, true).every((t) => t.is_online)).toBe(true);
  });

  it("manual crowd wins and auto recomputes from active orders", () => {
    demo.setCrowdMode(SAMRA, "manual", "busy");
    expect(demo.truckLiveState(SAMRA)?.crowd_status).toBe("busy");
    demo.setCrowdMode(SAMRA, "auto", null);
    expect(demo.truckLiveState(SAMRA)?.crowd_status).toBe("empty");
  });

  it("refuses to put a pending vendor's truck online", () => {
    expect(demo.setOnline(PENDING, true, RIYADH)).toBe("vendor_not_approved");
    expect(demo.setOnline(SAMRA, true, { lat: 24.75, lng: 46.65 })).toBeNull();
    expect(demo.nearbyTrucks(24.75, 46.65, 100, false)[0]?.id).toBe(SAMRA);
  });

  it("maps seeded phones to their profiles and creates customers for new numbers", () => {
    expect(demo.profileForPhone("+966500000002").role).toBe("vendor");
    const fresh = demo.profileForPhone("+966512345678");
    expect(fresh.role).toBe("customer");
    expect(demo.vendorContext(fresh.id)).toEqual({ vendor: null, truck: null });
  });
});
