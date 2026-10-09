/**
 * RLS / privilege tests against the local Supabase stack (`npx supabase start` + seed).
 * Signs in as real demo users via phone OTP (test OTP 123456 from supabase/config.toml).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const TRUCK = {
  hara: "20000000-0000-4000-8000-000000000001", // vendor +966500000002, busy
  samra: "20000000-0000-4000-8000-000000000004", // vendor +966500000005
  pending: "20000000-0000-4000-8000-000000000007", // vendor +966500000008 (pending)
};

type Client = SupabaseClient<Database>;

function anon(): Client {
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(phone: string): Promise<Client> {
  const client = anon();
  const sent = await client.auth.signInWithOtp({ phone });
  if (sent.error) throw sent.error;
  const { error } = await client.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (error) throw error;
  return client;
}

let customer: Client;
let samraVendor: Client;
let pendingVendor: Client;
let admin: Client;

beforeAll(async () => {
  [customer, samraVendor, pendingVendor, admin] = await Promise.all([
    signIn("+966500000001"),
    signIn("+966500000005"),
    signIn("+966500000008"),
    signIn("+966500000009"),
  ]);
});

describe("anonymous visitors", () => {
  it("see approved trucks but not a pending vendor's truck", async () => {
    const db = anon();
    const { data, error } = await db.rpc("nearby_trucks", { p_lat: 24.7136, p_lng: 46.6753 });
    expect(error).toBeNull();
    const ids = data!.map((t) => t.id);
    expect(ids).toContain(TRUCK.hara);
    expect(ids).not.toContain(TRUCK.pending);
    expect(ids).toHaveLength(6);

    const { data: hidden } = await db.from("trucks").select("id").eq("id", TRUCK.pending);
    expect(hidden).toEqual([]);
    const { data: hiddenMenu } = await db.from("menu_items").select("id").eq("truck_id", TRUCK.pending);
    expect(hiddenMenu).toEqual([]);
  });

  it("cannot read profiles, vendors or orders", async () => {
    const db = anon();
    for (const table of ["profiles", "vendors", "orders", "payments"] as const) {
      const { data } = await db.from(table).select("id");
      expect(data ?? []).toEqual([]);
    }
  });

  it("cannot modify trucks", async () => {
    const { error } = await anon().from("trucks").update({ name_ar: "hacked" }).eq("id", TRUCK.hara);
    expect(error?.code).toBe("42501");
  });
});

describe("customers", () => {
  it("read only their own profile and cannot change their role", async () => {
    const { data } = await customer.from("profiles").select("id, role");
    expect(data).toHaveLength(1);
    expect(data![0].role).toBe("customer");

    const { error } = await customer.from("profiles").update({ role: "admin" }).eq("id", data![0].id);
    expect(error?.code).toBe("42501");
  });

  it("see their own orders and cannot create orders directly", async () => {
    const { data } = await customer.from("orders").select("id");
    expect(data!.length).toBeGreaterThan(0);

    const { error } = await customer.from("orders").insert({
      customer_id: "00000000-0000-4000-8000-000000000001",
      truck_id: TRUCK.samra,
      type: "pickup",
      subtotal: 0,
      total: 0,
      pickup_slot_start: new Date().toISOString(),
    });
    expect(error?.code).toBe("42501");
  });

  it("cannot edit a truck", async () => {
    const { data } = await customer.from("trucks").update({ name_ar: "hacked" }).eq("id", TRUCK.hara).select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("vendors", () => {
  it("can edit their own truck but not someone else's", async () => {
    const own = await samraVendor.from("trucks").update({ avg_prep_minutes: 7 }).eq("id", TRUCK.samra).select("id");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const other = await samraVendor.from("trucks").update({ name_ar: "hacked" }).eq("id", TRUCK.hara).select("id");
    expect(other.data ?? []).toEqual([]);
  });

  it("cannot write computed crowd fields or their own approval status", async () => {
    const crowd = await samraVendor.from("trucks").update({ crowd_status: "empty" }).eq("id", TRUCK.samra);
    expect(crowd.error?.code).toBe("42501");
    const status = await samraVendor.from("vendors").update({ status: "approved" }).eq("id", "10000000-0000-4000-8000-000000000005");
    expect(status.error?.code).toBe("42501");
  });

  it("only see orders for their own trucks", async () => {
    const { data } = await samraVendor.from("orders").select("truck_id");
    expect((data ?? []).every((o) => o.truck_id === TRUCK.samra)).toBe(true);
  });

  it("cannot add menu items to another truck", async () => {
    const { error } = await samraVendor
      .from("menu_items")
      .insert({ truck_id: TRUCK.hara, name_ar: "دخيل", price: 1 });
    expect(error?.code).toBe("42501");
  });

  it("pending vendors can set up their truck but cannot go online", async () => {
    const { data } = await pendingVendor.from("trucks").select("id").eq("id", TRUCK.pending);
    expect(data).toHaveLength(1);

    const { error } = await pendingVendor.from("trucks").update({ is_online: true }).eq("id", TRUCK.pending);
    expect(error?.message).toBe("vendor_not_approved");
  });
});

describe("manual crowd override", () => {
  afterAll(async () => {
    await samraVendor.from("trucks").update({ crowd_mode: "auto", manual_crowd: null }).eq("id", TRUCK.samra);
  });

  it("wins over the auto level and auto mode recomputes from active orders", async () => {
    const manual = await samraVendor
      .from("trucks")
      .update({ crowd_mode: "manual", manual_crowd: "busy" })
      .eq("id", TRUCK.samra)
      .select("crowd_status")
      .single();
    expect(manual.data?.crowd_status).toBe("busy");

    const auto = await samraVendor
      .from("trucks")
      .update({ crowd_mode: "auto", manual_crowd: null })
      .eq("id", TRUCK.samra)
      .select("crowd_status, active_orders")
      .single();
    expect(auto.data).toEqual({ crowd_status: "empty", active_orders: 0 });
  });
});

describe("vendor onboarding", () => {
  it("turns a customer into a pending vendor and rejects duplicate CR numbers", async () => {
    const newcomer = await signIn("+966500000019");
    const dup = await newcomer.rpc("apply_as_vendor", {
      p_business_name: "نسخة",
      p_cr_number: "1010000002",
      p_municipality_license_no: "RYD-1",
    });
    expect(dup.error?.code).toBe("23505");

    const { error } = await newcomer.rpc("apply_as_vendor", {
      p_business_name: "ترك الاختبار",
      p_cr_number: "1010999019",
      p_municipality_license_no: "RYD-99019",
    });
    expect(error).toBeNull();

    const { data: profile } = await newcomer.from("profiles").select("role").single();
    expect(profile?.role).toBe("vendor");
    const { data: vendor } = await newcomer.from("vendors").select("status").single();
    expect(vendor?.status).toBe("pending");
  });
});

describe("admins", () => {
  it("can read all profiles and vendors", async () => {
    const { data: profiles } = await admin.from("profiles").select("id");
    expect(profiles!.length).toBeGreaterThanOrEqual(9);
    const { data: vendors } = await admin.from("vendors").select("id");
    expect(vendors!.length).toBeGreaterThanOrEqual(7);
  });
});
