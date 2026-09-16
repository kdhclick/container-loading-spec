import { NextResponse } from "next/server";
import type { PackingPlan } from "@/lib/types";

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ commentary: null, skipped: true });
  }

  let plan: PackingPlan;
  try {
    plan = (await request.json()) as PackingPlan;
  } catch {
    return NextResponse.json({ commentary: null, error: "invalid" }, { status: 400 });
  }

  const summary = [
    `컨테이너: ${plan.container.nameKo}`,
    `용적 활용률: ${(plan.utilization * 100).toFixed(1)}%`,
    `적재: ${plan.packedPieces}/${plan.totalPieces}개`,
    `중량: ${plan.packedWeightKg}kg / 한도 ${plan.container.maxPayloadKg}kg`,
    `화물: ${plan.cargo.map((c) => `${c.name} ${c.quantity}개`).join(", ")}`,
    `층수: ${plan.layers.length}`,
    plan.unpacked.length
      ? `미적재: ${plan.unpacked.map((u) => `${u.name} ${u.count}`).join(", ")}`
      : "전량 적재",
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 280,
        messages: [
          {
            role: "system",
            content:
              "당신은 컨테이너 적재 감독입니다. 한국어로 3~4문장의 짧은 적재 해설만 작성하세요. 현장 작업자가 바로 읽을 수 있게 층 순서, 중량 배분, 고정 요령을 구체적으로. 머리말이나 목록 기호는 쓰지 마세요.",
          },
          { role: "user", content: summary },
        ],
      }),
    });
    if (!response.ok) {
      return NextResponse.json({ commentary: null, skipped: true });
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const commentary = data.choices?.[0]?.message?.content?.trim() ?? null;
    return NextResponse.json({ commentary });
  } catch {
    return NextResponse.json({ commentary: null, skipped: true });
  }
}
