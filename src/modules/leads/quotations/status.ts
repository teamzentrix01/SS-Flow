export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_SENT_VIA = ["EMAIL", "WHATSAPP", "MANUAL"] as const;
export type QuotationSentVia = (typeof QUOTATION_SENT_VIA)[number];

export function quotationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    SENT: "Sent",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    EXPIRED: "Expired",
    SUPERSEDED: "Superseded",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function quotationIsEditable(status: string) {
  return status === "DRAFT";
}

export function quotationCanSend(status: string) {
  return status === "DRAFT";
}

export function quotationCanRevise(status: string) {
  return status === "SENT" || status === "EXPIRED";
}

export function quotationCanAcceptOnConvert(status: string) {
  return status === "SENT" || status === "ACCEPTED";
}
