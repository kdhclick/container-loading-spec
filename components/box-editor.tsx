"use client";

import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyCargoRow, exampleCargo } from "@/lib/examples";
import type { CargoRow, LengthUnit, ValidationIssue } from "@/lib/types";

interface BoxEditorProps {
  rows: CargoRow[];
  unit: LengthUnit;
  issues: ValidationIssue[];
  onUnitChange: (unit: LengthUnit) => void;
  onChange: (rows: CargoRow[]) => void;
}

function toDisplay(mm: number, unit: LengthUnit): string {
  if (!mm) return "";
  return unit === "cm" ? String(roundDisplay(mm / 10)) : String(roundDisplay(mm));
}

function roundDisplay(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function fromDisplay(value: string, unit: LengthUnit): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return unit === "cm" ? n * 10 : n;
}

export function BoxEditor({
  rows,
  unit,
  issues,
  onUnitChange,
  onChange,
}: BoxEditorProps) {
  const unitLabel = unit === "cm" ? "cm" : "mm";
  const invalidIds = new Set(issues.map((i) => i.rowId).filter(Boolean));

  const update = (id: string, patch: Partial<CargoRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">화물 입력</div>
          <p className="text-xs text-muted-foreground">
            치수는 상자 바깥 기준, 단위는 {unitLabel}로 통일되어 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={unit === "mm" ? "default" : "outline"}
            onClick={() => onUnitChange("mm")}
          >
            mm
          </Button>
          <Button
            type="button"
            size="sm"
            variant={unit === "cm" ? "default" : "outline"}
            onClick={() => onUnitChange("cm")}
          >
            cm
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>화물 행이 없습니다</AlertTitle>
          <AlertDescription>
            행을 추가하거나 예시 화물을 불러온 뒤 적재 계획을 계산하세요.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">품명</th>
                  <th className="pb-2 pr-2 font-medium">길이 ({unitLabel})</th>
                  <th className="pb-2 pr-2 font-medium">너비 ({unitLabel})</th>
                  <th className="pb-2 pr-2 font-medium">높이 ({unitLabel})</th>
                  <th className="pb-2 pr-2 font-medium">수량</th>
                  <th className="pb-2 pr-2 font-medium">중량 (kg)</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-1 pr-2">
                      <Input
                        aria-invalid={invalidIds.has(row.id) || undefined}
                        value={row.name}
                        placeholder="예: 골판지 상자"
                        onChange={(e) => update(row.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        inputMode="decimal"
                        aria-invalid={invalidIds.has(row.id) || undefined}
                        value={toDisplay(row.length, unit)}
                        onChange={(e) =>
                          update(row.id, { length: fromDisplay(e.target.value, unit) })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        inputMode="decimal"
                        value={toDisplay(row.width, unit)}
                        onChange={(e) =>
                          update(row.id, { width: fromDisplay(e.target.value, unit) })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        inputMode="decimal"
                        value={toDisplay(row.height, unit)}
                        onChange={(e) =>
                          update(row.id, { height: fromDisplay(e.target.value, unit) })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        inputMode="numeric"
                        value={row.quantity || ""}
                        onChange={(e) =>
                          update(row.id, {
                            quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        inputMode="decimal"
                        placeholder="선택"
                        value={row.weightKg ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          update(row.id, {
                            weightKg: raw === "" ? null : Number(raw),
                          });
                        }}
                      />
                    </td>
                    <td className="py-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="행 삭제"
                        onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 xl:hidden">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="space-y-2 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{index + 1}행</span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="행 삭제"
                    onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`name-${row.id}`}>품명</Label>
                  <Input
                    id={`name-${row.id}`}
                    value={row.name}
                    placeholder="예: 골판지 상자"
                    onChange={(e) => update(row.id, { name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label>길이 ({unitLabel})</Label>
                    <Input
                      inputMode="decimal"
                      value={toDisplay(row.length, unit)}
                      onChange={(e) =>
                        update(row.id, { length: fromDisplay(e.target.value, unit) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>너비 ({unitLabel})</Label>
                    <Input
                      inputMode="decimal"
                      value={toDisplay(row.width, unit)}
                      onChange={(e) =>
                        update(row.id, { width: fromDisplay(e.target.value, unit) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>높이 ({unitLabel})</Label>
                    <Input
                      inputMode="decimal"
                      value={toDisplay(row.height, unit)}
                      onChange={(e) =>
                        update(row.id, { height: fromDisplay(e.target.value, unit) })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>수량</Label>
                    <Input
                      inputMode="numeric"
                      value={row.quantity || ""}
                      onChange={(e) =>
                        update(row.id, {
                          quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>중량 (kg)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="선택"
                      value={row.weightKg ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        update(row.id, {
                          weightKg: raw === "" ? null : Number(raw),
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, emptyCargoRow()])}
        >
          <Plus data-icon="inline-start" />
          행 추가
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(exampleCargo())}>
          예시 화물 넣기
        </Button>
      </div>
    </div>
  );
}
