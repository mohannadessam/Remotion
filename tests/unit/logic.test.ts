import { describe, expect, it } from "vitest";
import { crowdLevelFor, displayCrowd, estimatedWaitMinutes } from "@/lib/crowd";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { menuItemSchema, truckProfileSchema, vendorApplicationSchema } from "@/lib/validation";

describe("crowd", () => {
  it.each([
    [0, "empty"],
    [3, "empty"],
    [4, "moderate"],
    [8, "moderate"],
    [9, "busy"],
    [30, "busy"],
  ] as const)("%i active orders -> %s", (n, level) => {
    expect(crowdLevelFor(n)).toBe(level);
  });

  it("respects custom thresholds", () => {
    expect(crowdLevelFor(5, { emptyMax: 5, moderateMax: 10 })).toBe("empty");
  });

  it("estimates wait = ceil(active * prep / parallelism)", () => {
    expect(estimatedWaitMinutes(10, 8, 2)).toBe(40);
    expect(estimatedWaitMinutes(5, 6, 3)).toBe(10);
    expect(estimatedWaitMinutes(1, 5, 2)).toBe(3);
    expect(estimatedWaitMinutes(0, 10, 2)).toBe(0);
  });

  it("offline trucks display as offline", () => {
    expect(displayCrowd({ is_online: false, crowd_status: "busy" })).toBe("offline");
    expect(displayCrowd({ is_online: true, crowd_status: "busy" })).toBe("busy");
  });
});

describe("geo", () => {
  it("computes great-circle distance", () => {
    // Kingdom Tower -> Al Faisaliah Tower is ~2.9 km
    const d = distanceMeters({ lat: 24.7114, lng: 46.6744 }, { lat: 24.6904, lng: 46.6853 });
    expect(d).toBeGreaterThan(2500);
    expect(d).toBeLessThan(2700);
  });

  it("formats distances", () => {
    expect(formatDistance(843, "en")).toBe("840 m");
    expect(formatDistance(2345, "en")).toBe("2.3 km");
    expect(formatDistance(12_600, "en")).toBe("13 km");
  });
});

describe("validation", () => {
  it("vendor application normalizes digits and license", () => {
    const parsed = vendorApplicationSchema.parse({
      businessName: "  ترك التجربة ",
      crNumber: "١٠١٠١٢٣٤٥٦",
      municipalityLicenseNo: "ryd-123",
    });
    expect(parsed).toEqual({ businessName: "ترك التجربة", crNumber: "1010123456", municipalityLicenseNo: "RYD-123" });
  });

  it("rejects a short CR number with an i18n key", () => {
    const res = vendorApplicationSchema.safeParse({ businessName: "abc", crNumber: "123", municipalityLicenseNo: "RYD-1" });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].message).toBe("invalidCr");
  });

  it("caps delivery radius at 5 km", () => {
    const base = {
      nameAr: "ترك",
      cuisine: "burgers",
      avgPrepMinutes: 10,
      parallelism: 2,
      slotCapacity: 6,
      deliveryEnabled: true,
      deliveryFee: 10,
    };
    expect(truckProfileSchema.safeParse({ ...base, deliveryRadiusM: 5000 }).success).toBe(true);
    expect(truckProfileSchema.safeParse({ ...base, deliveryRadiusM: 5001 }).success).toBe(false);
  });

  it("menu item coerces numbers, rounds price and nulls empty optionals", () => {
    const item = menuItemSchema.parse({
      nameAr: "برجر",
      nameEn: "",
      price: "12.345",
      prepMinutes: "7",
      isAvailable: true,
      categoryId: null,
    });
    expect(item).toMatchObject({ price: 12.35, prepMinutes: 7, nameEn: null, imageUrl: null, categoryId: null });
    expect(menuItemSchema.safeParse({ nameAr: "x", price: -1, prepMinutes: 1, isAvailable: true }).success).toBe(false);
  });
});
