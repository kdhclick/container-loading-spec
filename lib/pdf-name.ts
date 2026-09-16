import type { PackingPlan } from "@/lib/types";

export function specFilename(plan: PackingPlan): string {
  const d = new Date(plan.createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `적재시방서-${plan.container.id}-${y}${m}${day}.pdf`;
}
