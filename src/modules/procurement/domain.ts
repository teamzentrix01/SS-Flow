import { toMilli } from "@/lib/domain/qty";

export const PO_STATUSES = {
  draft: "draft",
  pendingApproval: "pending_approval",
  approved: "approved",
  sent: "sent",
  partial: "partial",
  received: "received",
  cancelled: "cancelled",
} as const;

export type PoStatus = (typeof PO_STATUSES)[keyof typeof PO_STATUSES];

export const RECEIPT_STATUSES = {
  draft: "draft",
  posted: "posted",
  cancelled: "cancelled",
} as const;

export type ReceiptStatus = (typeof RECEIPT_STATUSES)[keyof typeof RECEIPT_STATUSES];

/** PO statuses that allow creating or editing draft receipts. */
export const RECEIVABLE_PO_STATUSES: PoStatus[] = [
  PO_STATUSES.approved,
  PO_STATUSES.sent,
  PO_STATUSES.partial,
];

export function outstandingMilli(ordered: string, receivedAccepted: string) {
  return toMilli(ordered) - toMilli(receivedAccepted);
}

export function receiptLineTotals(input: {
  delivered: string;
  accepted: string;
  rejected: string;
}) {
  const delivered = toMilli(input.delivered);
  const accepted = toMilli(input.accepted);
  const rejected = toMilli(input.rejected);
  if (delivered <= 0n) return { error: "DELIVERED_REQUIRED" as const };
  if (accepted < 0n || rejected < 0n) return { error: "QTY_NEGATIVE" as const };
  if (accepted + rejected !== delivered) return { error: "DELIVERED_SPLIT" as const };
  return { delivered, accepted, rejected, error: null };
}

export function assertSameUom(orderUom: string, lineUom: string) {
  const a = orderUom.trim().toUpperCase();
  const b = lineUom.trim().toUpperCase();
  if (a !== b) return { error: "UOM_MISMATCH" as const };
  return { error: null };
}

export function assertWithinOutstanding(
  accepted: bigint,
  outstanding: bigint,
  options?: { allowOverReceipt?: boolean },
) {
  if (options?.allowOverReceipt) return { error: null };
  if (accepted > outstanding) return { error: "OVER_RECEIPT" as const };
  return { error: null };
}

export function derivePoReceiptStatus(
  items: { qty: string; receivedQty: string }[],
): PoStatus {
  if (items.length === 0) return PO_STATUSES.approved;
  const allDone = items.every(
    (item) => toMilli(item.receivedQty) >= toMilli(item.qty),
  );
  if (allDone) return PO_STATUSES.received;
  const anyReceived = items.some((item) => toMilli(item.receivedQty) > 0n);
  if (anyReceived) return PO_STATUSES.partial;
  return PO_STATUSES.sent;
}

export function canEditPo(status: string) {
  return status === PO_STATUSES.draft;
}

export function canSubmitPo(status: string) {
  return status === PO_STATUSES.draft;
}

export function canApprovePo(status: string) {
  return status === PO_STATUSES.pendingApproval;
}

export function canSendPo(status: string) {
  return status === PO_STATUSES.approved;
}

const CANCELLABLE: PoStatus[] = [
  PO_STATUSES.draft,
  PO_STATUSES.pendingApproval,
  PO_STATUSES.approved,
  PO_STATUSES.sent,
];

export function canCancelPo(status: string) {
  return CANCELLABLE.includes(status as PoStatus);
}
