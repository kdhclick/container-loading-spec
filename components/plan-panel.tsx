"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { colorForKey } from "@/lib/colors";
import type { PackingPlan } from "@/lib/types";

interface PlanPanelProps {
  plan: PackingPlan | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  step: number;
}

export function PlanPanel({ plan, selectedId, onSelect, step }: PlanPanelProps) {
  if (!plan) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        아직 적재 계획이 없습니다. 컨테이너와 화물을 입력한 뒤
        <span className="font-medium text-foreground"> 적재 계획 계산</span>을 누르세요.
      </div>
    );
  }

  const shown = plan.placed.filter((b) => b.sequence <= step);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="용적 활용률"
          value={`${(plan.utilization * 100).toFixed(1)}%`}
        />
        <Stat
          label="적재 개수"
          value={`${plan.packedPieces}/${plan.totalPieces}`}
        />
        {plan.solver === "grid" ? (
          <Stat label="좌우 배치" value="안쪽부터 295×5 + 395×2" />
        ) : null}
        <Stat
          label="적재 중량"
          value={`${plan.packedWeightKg.toLocaleString("ko-KR", {
            maximumFractionDigits: 1,
          })} kg`}
        />
        <Stat
          label="솔버"
          value={
            plan.solver === "extreme-point"
              ? "익스트림 포인트"
              : plan.solver === "grid"
                ? "격자 적재"
                : "최대잔여공간"
          }
        />
      </div>

      {plan.volumeExceeded && plan.volumeNote ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>부피 초과</AlertTitle>
          <AlertDescription>{plan.volumeNote}</AlertDescription>
        </Alert>
      ) : null}

      {plan.payloadExceeded ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>최대 적재중량 초과</AlertTitle>
          <AlertDescription>
            컨테이너 페이로드 {plan.container.maxPayloadKg.toLocaleString("ko-KR")} kg을
            넘습니다. 수량을 줄이거나 더 큰 사양을 검토하세요.
          </AlertDescription>
        </Alert>
      ) : null}

      {plan.unpacked.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>넣지 못한 화물</AlertTitle>
          <AlertDescription>
            {plan.unpacked.map((u) => `${u.name} ${u.count}개`).join(", ")}.
            {plan.volumeExceeded
              ? " 부피가 넘치는 수량은 다른 컨테이너로 나누세요."
              : " 치수를 줄이거나 컨테이너를 키워 보세요."}
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-xs text-muted-foreground">입력한 화물을 모두 넣었습니다.</p>
      )}

      <Separator />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">적재 순서</div>
          <Badge variant="secondary">{shown.length}개 표시</Badge>
        </div>
        <ScrollArea className="h-56 pr-2">
          <ol className="space-y-1">
            {plan.placed.map((box) => {
              const dimmed = box.sequence > step;
              const active = box.id === selectedId;
              return (
                <li key={box.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(box.id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"
                    } ${dimmed ? "opacity-40" : ""}`}
                  >
                    <span
                      className="mt-0.5 size-2.5 shrink-0 rounded-sm"
                      style={{ background: colorForKey(box.cargoId) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {box.sequence}. {box.name}
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">
                        X {Math.round(box.x)} · Y {Math.round(box.y)} · Z{" "}
                        {Math.round(box.z)} mm · {box.rotationLabel}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      </div>

      {plan.layers.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-sm font-medium">층별 메모</div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {plan.layers.map((layer) => (
              <li key={layer.layer}>제{layer.layer}층 — {layer.note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
