"use client";

import { Download, Loader2, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { BoxEditor } from "@/components/box-editor";
import { ContainerPicker } from "@/components/container-picker";
import { PackingViewer } from "@/components/packing-viewer";
import { PlanPanel } from "@/components/plan-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContainer } from "@/lib/containers";
import { emptyCargoRow, exampleCargo } from "@/lib/examples";
import { packCargo, validateCargo } from "@/lib/packing";
import { downloadSpecPdf } from "@/lib/download-spec";
import type { CargoRow, LengthUnit, PackingPlan, ValidationIssue } from "@/lib/types";

export function LoadingPlanner() {
  const [containerId, setContainerId] = useState("20ft-dry");
  const [rows, setRows] = useState<CargoRow[]>(() => exampleCargo());
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [plan, setPlan] = useState<PackingPlan | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [solving, setSolving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const container = useMemo(() => getContainer(containerId), [containerId]);

  const solve = () => {
    const nextIssues = validateCargo(rows, container);
    setIssues(nextIssues);
    setExportError(null);
    if (nextIssues.length > 0) {
      setPlan(null);
      setStep(0);
      return;
    }
    setSolving(true);
    window.setTimeout(() => {
      const next = packCargo(rows, container);
      setPlan(next);
      setStep(next.placed.length);
      setSelectedId(null);
      setSolving(false);
    }, 30);
  };

  const exportPdf = async () => {
    if (!plan) return;
    setExporting(true);
    setExportError(null);
    try {
      let commentary: string | null = null;
      try {
        const res = await fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        if (res.ok) {
          const data = (await res.json()) as { commentary?: string | null };
          commentary = data.commentary ?? null;
        }
      } catch {
        commentary = null;
      }
      await downloadSpecPdf(plan, commentary);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "시방서 PDF를 만들지 못했습니다.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary p-2 text-primary-foreground">
              <Package className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">컨테이너 적재 시방서</h1>
              <p className="text-sm text-muted-foreground">
                컨테이너를 고르고 상자 치수를 넣으면 3D 적재안과 한국어 시방서를 만듭니다.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={solve} disabled={solving}>
              {solving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              적재 계획 계산
            </Button>
            <Button type="button" onClick={exportPdf} disabled={!plan || exporting}>
              {exporting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              시방서 PDF 내려받기
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-4 px-4 py-4 xl:grid-cols-[360px_minmax(0,1fr)_320px] xl:items-start">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>컨테이너 선택</CardTitle>
              <p className="text-xs text-muted-foreground">
                ISO 건식 컨테이너 내부 치수입니다. 선택하면 오른쪽 3D에 빈 박스가 바뀝니다.
              </p>
            </CardHeader>
            <CardContent>
              <ContainerPicker
                value={containerId}
                onChange={(id) => {
                  setContainerId(id);
                  setPlan(null);
                  setStep(0);
                  setSelectedId(null);
                  setIssues([]);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>화물</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BoxEditor
                rows={rows}
                unit={unit}
                issues={issues}
                onUnitChange={setUnit}
                onChange={(next) => {
                  setRows(next);
                  setPlan(null);
                  setStep(0);
                  setSelectedId(null);
                }}
              />
              {issues.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTitle>입력을 확인하세요</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {issues.map((issue) => (
                        <li key={`${issue.rowId ?? "g"}-${issue.message}`}>{issue.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {exportError ? (
                <Alert variant="destructive">
                  <AlertTitle>PDF 오류</AlertTitle>
                  <AlertDescription>{exportError}</AlertDescription>
                </Alert>
              ) : null}
              {rows.length === 0 ? (
                <Button type="button" variant="secondary" onClick={() => setRows([emptyCargoRow()])}>
                  빈 행 하나 추가
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="xl:sticky xl:top-4 xl:h-[calc(100vh-6.5rem)]">
          <PackingViewer
            container={container}
            boxes={plan?.placed ?? []}
            step={step}
            selectedId={selectedId}
            onStepChange={setStep}
            onSelect={setSelectedId}
            solving={solving}
          />
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>적재 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanPanel
                plan={plan}
                selectedId={selectedId}
                onSelect={setSelectedId}
                step={step}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
