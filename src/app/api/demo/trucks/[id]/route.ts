import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/demo/mode";
import { truckLiveState } from "@/lib/demo/store";

// Demo-mode stand-in for polling one truck's live state.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!DEMO_MODE) return new NextResponse(null, { status: 404 });
  const state = truckLiveState((await params).id);
  return state ? NextResponse.json(state) : new NextResponse(null, { status: 404 });
}
