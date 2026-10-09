import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEMO_MODE } from "@/lib/demo/mode";
import { nearbyTrucks } from "@/lib/demo/store";

// Demo-mode stand-in for the nearby_trucks() RPC.
const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(50_000).default(10_000),
  online: z.enum(["true", "false"]).default("false"),
});

export function GET(request: NextRequest) {
  if (!DEMO_MODE) return new NextResponse(null, { status: 404 });
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalidInput" }, { status: 400 });
  const { lat, lng, radius, online } = parsed.data;
  return NextResponse.json(nearbyTrucks(lat, lng, radius, online === "true"));
}
