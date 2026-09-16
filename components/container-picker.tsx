"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CONTAINERS, formatInnerDims } from "@/lib/containers";
import type { ContainerSpec } from "@/lib/types";

interface ContainerPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function ContainerPicker({ value, onChange }: ContainerPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CONTAINERS.map((c) => (
        <ContainerCard
          key={c.id}
          container={c}
          selected={c.id === value}
          onSelect={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

function ContainerCard({
  container,
  selected,
  onSelect,
}: {
  container: ContainerSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/8 ring-2 ring-primary/30"
          : "border-border bg-card hover:bg-muted/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">{container.nameKo}</div>
        {selected ? <Badge>선택</Badge> : null}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{container.nameEn}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        내부 {formatInnerDims(container)}
        <br />
        용적 {container.volumeM3.toFixed(1)} m³ · 페이로드{" "}
        {container.maxPayloadKg.toLocaleString("ko-KR")} kg
      </div>
    </button>
  );
}
