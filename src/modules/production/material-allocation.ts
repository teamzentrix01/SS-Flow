import { toMilli, fromMilli } from "@/lib/domain/qty";

export type ProposedMaterialAllocation = {
  batchId: string;
  qty: string;
  allocatableQty: string;
  qcPassed: boolean;
  compatible: boolean;
};

export function validateMaterialAllocationPlan(requiredQty: string, proposed: ProposedMaterialAllocation[]) {
  if (!proposed.length) return { error: "MATERIAL_REQUIRED" as const };
  const seen = new Set<string>();
  let total = 0n;
  for (const line of proposed) {
    if (seen.has(line.batchId)) return { error: "DUPLICATE_BATCH" as const };
    seen.add(line.batchId);
    if (!line.qcPassed) return { error: "BATCH_NOT_ISSUABLE" as const };
    if (!line.compatible) return { error: "MATERIAL_INCOMPATIBLE" as const };
    const qty = toMilli(line.qty);
    if (qty <= 0n) return { error: "QTY_INVALID" as const };
    if (qty > toMilli(line.allocatableQty)) return { error: "INSUFFICIENT_STOCK" as const };
    total += qty;
  }
  if (total > toMilli(requiredQty)) return { error: "OVER_ALLOCATION" as const };
  return { error: null, total: fromMilli(total) };
}

export function splitConsumption<T extends { id: string; batchId: string; issuedQty: string }>(
  lines: T[],
  consumedQty: string,
) {
  let remaining = toMilli(consumedQty);
  const totalIssued = lines.reduce((sum, line) => sum + toMilli(line.issuedQty), 0n);
  if (remaining < 0n || remaining > totalIssued) return { error: "CONSUMPTION_EXCEEDS_ISSUE" as const };
  const rows = lines.map((line) => {
    const issued = toMilli(line.issuedQty);
    const consumed = remaining < issued ? remaining : issued;
    remaining -= consumed;
    return { ...line, consumedQty: fromMilli(consumed), returnedQty: fromMilli(issued - consumed) };
  });
  return { error: null, rows };
}
