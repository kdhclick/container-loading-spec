import { specFilename } from "@/lib/pdf-name";
import type { PackingPlan } from "@/lib/types";

export async function downloadSpecPdf(
  plan: PackingPlan,
  commentary?: string | null,
): Promise<void> {
  const res = await fetch("/api/spec-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, commentary }),
  });
  if (!res.ok) {
    throw new Error("시방서 PDF를 만들지 못했습니다.");
  }
  const blob = await res.blob();
  const headerName = res.headers.get("X-Spec-Filename");
  const filename = headerName ? decodeURIComponent(headerName) : specFilename(plan);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
