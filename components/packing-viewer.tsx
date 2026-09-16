"use client";

import dynamic from "next/dynamic";
import { Slider } from "@/components/ui/slider";
import type { ContainerSpec, PlacedBox } from "@/lib/types";

const PackingCanvas = dynamic(() => import("@/components/packing-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      3D 뷰를 준비하는 중…
    </div>
  ),
});

interface PackingViewerProps {
  container: ContainerSpec;
  boxes: PlacedBox[];
  step: number;
  selectedId: string | null;
  onStepChange: (step: number) => void;
  onSelect: (id: string | null) => void;
  solving: boolean;
}

export function PackingViewer({
  container,
  boxes,
  step,
  selectedId,
  onStepChange,
  onSelect,
  solving,
}: PackingViewerProps) {
  const max = Math.max(boxes.length, 1);
  const selected = boxes.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl bg-[#F4F6F8] ring-1 ring-foreground/10">
      <div className="relative min-h-[280px] flex-1">
        <PackingCanvas
          container={container}
          boxes={boxes}
          visibleThrough={step}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        {solving ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-foreground">
            적재 최적안을 계산하는 중…
          </div>
        ) : null}
        {boxes.length > 0 && !solving ? (
          <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs text-foreground shadow-sm ring-1 ring-foreground/10">
            안쪽 벽부터 적재 · {boxes.length.toLocaleString("ko-KR")}개
          </div>
        ) : null}
        {boxes.length === 0 && !solving ? (
          <div className="pointer-events-none absolute top-3 left-3 right-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-foreground shadow-sm ring-1 ring-foreground/10">
            빈 컨테이너입니다. 화물을 입력한 뒤 적재 계획을 계산하면 상자가 표시됩니다.
            드래그로 회전, 스크롤로 확대하세요.
          </div>
        ) : null}
        {selected ? (
          <div className="pointer-events-none absolute right-3 bottom-14 max-w-[220px] rounded-lg bg-white/95 px-3 py-2 text-xs text-foreground shadow-sm ring-1 ring-foreground/10">
            <div className="font-medium">
              {selected.sequence}번 · {selected.name}
            </div>
            <div className="mt-1 text-muted-foreground">
              위치 {Math.round(selected.x)}, {Math.round(selected.y)},{" "}
              {Math.round(selected.z)} mm
              <br />
              {selected.rotationLabel}
            </div>
          </div>
        ) : null}
      </div>
      <div className="space-y-2 border-t border-foreground/10 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>적재 순서 (선적 · 하단부터)</span>
          <span>
            {boxes.length === 0 ? "0 / 0" : `${step} / ${boxes.length}`}
          </span>
        </div>
        <Slider
          min={0}
          max={max}
          step={1}
          value={[Math.min(step, max)]}
          disabled={boxes.length === 0}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            onStepChange(Number(next) || 0);
          }}
        />
      </div>
    </div>
  );
}
