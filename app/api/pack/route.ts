import { NextResponse } from "next/server";
import { getContainer } from "@/lib/containers";
import { packCargo } from "@/lib/packing";
import type { CargoRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { rows?: CargoRow[]; containerId?: string };
  try {
    body = (await request.json()) as { rows?: CargoRow[]; containerId?: string };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || !body.containerId) {
    return NextResponse.json({ error: "rows and containerId required" }, { status: 400 });
  }

  const container = getContainer(body.containerId);
  const plan = packCargo(body.rows, container);
  return NextResponse.json(plan, {
    headers: { "Cache-Control": "no-store" },
  });
}
