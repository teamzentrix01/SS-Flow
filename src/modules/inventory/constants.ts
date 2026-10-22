import type { MovementType } from "@/lib/domain/buckets";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  receipt: "GRN receipt",
  receipt_reject: "GRN rejection",
  qc_release: "QC release",
  qc_reject: "QC rejection",
  reserve: "Reservation",
  unreserve: "Reservation release",
  issue: "Material issue",
  return: "Return to stock",
  consume: "Production consumption",
  output: "Production output",
  finish_release: "Finished-goods release",
  scrap: "Scrap",
  reject_output: "Rejected output",
  dispatch: "Dispatch",
  dispatch_reserved: "Dispatch reserved stock",
  adjust: "Stock adjustment",
  transfer_out: "Location transfer out",
  transfer_in: "Location transfer in",
  inter_factory_dispatch_out: "Factory transfer dispatch",
  inter_factory_dispatch_in: "Factory transfer in-transit",
  inter_factory_receive_out: "Factory transfer leave source",
  inter_factory_receive_in: "Factory transfer receive",
  inter_factory_reject: "Factory transfer reject",
};

export const MOVEMENT_TYPES = Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[];

export const ADJUSTMENT_REASONS = [
  "Physical count correction",
  "Damage",
  "Approved write-off",
  "Found stock",
  "Data correction",
  "Other authorized reason",
] as const;

export const OPEN_PO_STATUSES = ["approved", "sent", "partial"] as const;
export const OPEN_TRANSFER_STATUSES = ["draft", "in_transit"] as const;

export const REGISTER_SORTS = [
  "code",
  "name",
  "category",
  "plant",
  "available",
  "reserved",
  "qcHold",
  "rejected",
  "wip",
  "finished",
  "scrap",
  "physical",
  "updatedAt",
] as const;

export type RegisterSort = (typeof REGISTER_SORTS)[number];
