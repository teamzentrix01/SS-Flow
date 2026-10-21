import { toMilli } from "./qty";

export type Buckets = {
  available: bigint;
  reserved: bigint;
  qcHold: bigint;
  wip: bigint;
  finished: bigint;
  scrap: bigint;
  rejected: bigint;
};

export type MovementType =
  | "receipt"
  | "receipt_reject"
  | "qc_release"
  | "qc_reject"
  | "reserve"
  | "unreserve"
  | "issue"
  | "return"
  | "consume"
  | "output"
  | "finish_release"
  | "scrap"
  | "reject_output"
  | "dispatch"
  | "adjust"
  | "transfer_out"
  | "transfer_in";

export function emptyBuckets(): Buckets {
  return {
    available: 0n,
    reserved: 0n,
    qcHold: 0n,
    wip: 0n,
    finished: 0n,
    scrap: 0n,
    rejected: 0n,
  };
}

export function physicalQty(buckets: Buckets) {
  return (
    buckets.available +
    buckets.reserved +
    buckets.qcHold +
    buckets.wip +
    buckets.finished +
    buckets.scrap +
    buckets.rejected
  );
}

function take(buckets: Buckets, field: keyof Buckets, qty: bigint) {
  if (buckets[field] < qty) {
    const error = new Error("INSUFFICIENT_STOCK");
    throw error;
  }
  buckets[field] -= qty;
}

export function applyMovement(buckets: Buckets, type: MovementType, qty: bigint): Buckets {
  if (type !== "adjust" && qty <= 0n) {
    throw new Error("QTY_INVALID");
  }
  const next = { ...buckets };
  switch (type) {
    case "receipt":
    case "output":
      next.qcHold += qty;
      break;
    case "receipt_reject":
      next.rejected += qty;
      break;
    case "qc_release":
      take(next, "qcHold", qty);
      next.available += qty;
      break;
    case "qc_reject":
      take(next, "qcHold", qty);
      next.rejected += qty;
      break;
    case "finish_release":
      take(next, "qcHold", qty);
      next.finished += qty;
      break;
    case "reserve":
      take(next, "available", qty);
      next.reserved += qty;
      break;
    case "unreserve":
      take(next, "reserved", qty);
      next.available += qty;
      break;
    case "issue":
      take(next, "reserved", qty);
      next.wip += qty;
      break;
    case "return":
      take(next, "wip", qty);
      next.available += qty;
      break;
    case "consume":
      take(next, "wip", qty);
      break;
    case "scrap":
      next.scrap += qty;
      break;
    case "reject_output":
      next.rejected += qty;
      break;
    case "dispatch":
      take(next, "finished", qty);
      break;
    case "transfer_out":
      take(next, "available", qty);
      break;
    case "transfer_in":
      next.available += qty;
      break;
    case "adjust":
      next.available += qty;
      if (next.available < 0n) throw new Error("INSUFFICIENT_STOCK");
      break;
    default:
      throw new Error("QTY_INVALID");
  }
  return next;
}

export function bucketsFromRow(row: {
  available_qty: string;
  reserved_qty: string;
  qc_hold_qty: string;
  wip_qty: string;
  finished_qty: string;
  scrap_qty: string;
  rejected_qty: string;
}): Buckets {
  return {
    available: toMilli(row.available_qty),
    reserved: toMilli(row.reserved_qty),
    qcHold: toMilli(row.qc_hold_qty),
    wip: toMilli(row.wip_qty),
    finished: toMilli(row.finished_qty),
    scrap: toMilli(row.scrap_qty),
    rejected: toMilli(row.rejected_qty),
  };
}
