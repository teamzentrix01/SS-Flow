import { physicalQty, type Buckets } from "@/lib/domain/buckets";
import { toMilli } from "@/lib/domain/qty";

export const STOCK_STATUSES = [
  "available",
  "low_stock",
  "out_of_stock",
  "qc_hold",
  "rejected",
  "in_transit",
] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export function milliOf(value: { toString(): string } | string | number | null | undefined) {
  return toMilli((value ?? "0").toString());
}

export function bucketsFromQty(row: {
  availableQty: { toString(): string };
  reservedQty: { toString(): string };
  qcHoldQty: { toString(): string };
  wipQty: { toString(): string };
  finishedQty: { toString(): string };
  scrapQty: { toString(): string };
  rejectedQty: { toString(): string };
  inTransitQty: { toString(): string };
}): Buckets {
  return {
    available: milliOf(row.availableQty),
    reserved: milliOf(row.reservedQty),
    qcHold: milliOf(row.qcHoldQty),
    wip: milliOf(row.wipQty),
    finished: milliOf(row.finishedQty),
    scrap: milliOf(row.scrapQty),
    rejected: milliOf(row.rejectedQty),
    inTransit: milliOf(row.inTransitQty),
  };
}

/** Display status. Available-to-promise is `available` only — QC-hold and rejected are never treated as usable. */
export function deriveStockStatus(
  buckets: Buckets,
  reorderLevel: bigint | null,
): StockStatus {
  const physical = physicalQty(buckets);
  if (buckets.available <= 0n) {
    if (physical <= 0n) return "out_of_stock";
    if (buckets.qcHold > 0n) return "qc_hold";
    if (buckets.inTransit > 0n) return "in_transit";
    if (buckets.rejected > 0n) return "rejected";
    return "out_of_stock";
  }
  if (reorderLevel != null && buckets.available < reorderLevel) return "low_stock";
  return "available";
}

export function matchesStockStatus(status: StockStatus | undefined, buckets: Buckets, reorderLevel: bigint | null) {
  if (!status) return true;
  if (status === "qc_hold") return buckets.qcHold > 0n;
  if (status === "rejected") return buckets.rejected > 0n;
  if (status === "in_transit") return buckets.inTransit > 0n;
  if (status === "out_of_stock") return buckets.available <= 0n;
  if (status === "low_stock") return reorderLevel != null && buckets.available > 0n && buckets.available < reorderLevel;
  if (status === "available") return buckets.available > 0n;
  return true;
}
