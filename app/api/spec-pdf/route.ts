import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { specFilename } from "@/lib/pdf-name";
import { buildSpecPdf } from "@/lib/pdf";
import type { PackingPlan } from "@/lib/types";

export async function POST(request: Request) {
  let body: { plan?: PackingPlan; commentary?: string | null };
  try {
    body = (await request.json()) as { plan?: PackingPlan; commentary?: string | null };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!body.plan?.container || !Array.isArray(body.plan.placed)) {
    return NextResponse.json({ error: "plan required" }, { status: 400 });
  }

  const font = await readFile(join(process.cwd(), "public/fonts/NanumGothic-Regular.ttf"));
  const bytes = await buildSpecPdf(body.plan, font, body.commentary ?? null);
  const filename = specFilename(body.plan);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Spec-Filename": encodeURIComponent(filename),
    },
  });
}
