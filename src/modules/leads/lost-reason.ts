export const LOST_REASON_CODES = [
  "PRICE_HIGH",
  "COMPETITOR_CHEAPER",
  "GRADE_SIZE_NOT_AVAILABLE",
  "DELIVERY_TIME_LONG",
  "CREDIT_TERMS_NOT_MET",
  "DESIGN_FINISH_NOT_ACCEPTED",
  "MOQ_TOO_HIGH",
  "SAMPLE_REJECTED",
  "REQUIREMENT_CANCELLED",
  "NO_RESPONSE",
  "LOCATION_ISSUE",
  "OTHER",
] as const;

export const REJECTED_REASON_CODES = [
  "BELOW_MOQ",
  "OUTSIDE_DELIVERY_AREA",
  "FAKE_OR_SPAM",
  "NOT_OUR_PRODUCT",
  "OTHER",
] as const;

export type LostReasonCode = (typeof LOST_REASON_CODES)[number];
export type RejectedReasonCode = (typeof REJECTED_REASON_CODES)[number];

const LOST_LABELS: Record<LostReasonCode, string> = {
  PRICE_HIGH: "Price too high",
  COMPETITOR_CHEAPER: "Competitor cheaper",
  GRADE_SIZE_NOT_AVAILABLE: "Grade / size not available",
  DELIVERY_TIME_LONG: "Delivery time too long",
  CREDIT_TERMS_NOT_MET: "Credit terms not met",
  DESIGN_FINISH_NOT_ACCEPTED: "Design / finish not accepted",
  MOQ_TOO_HIGH: "MOQ too high",
  SAMPLE_REJECTED: "Sample rejected",
  REQUIREMENT_CANCELLED: "Requirement cancelled",
  NO_RESPONSE: "No response from customer",
  LOCATION_ISSUE: "Location / logistics issue",
  OTHER: "Other",
};

const REJECTED_LABELS: Record<RejectedReasonCode, string> = {
  BELOW_MOQ: "Below MOQ",
  OUTSIDE_DELIVERY_AREA: "Outside delivery area",
  FAKE_OR_SPAM: "Fake or spam enquiry",
  NOT_OUR_PRODUCT: "Not our product range",
  OTHER: "Other",
};

export function lostReasonLabel(code: string | null | undefined, outcome: "LOST" | "REJECTED") {
  if (!code) return "—";
  if (outcome === "LOST" && code in LOST_LABELS) return LOST_LABELS[code as LostReasonCode];
  if (outcome === "REJECTED" && code in REJECTED_LABELS) return REJECTED_LABELS[code as RejectedReasonCode];
  return code.replaceAll("_", " ");
}

export function isLostReasonCodeForStatus(status: "LOST" | "REJECTED", code: string) {
  const key = code.trim().toUpperCase();
  if (status === "LOST") return LOST_REASON_CODES.includes(key as LostReasonCode);
  return REJECTED_REASON_CODES.includes(key as RejectedReasonCode);
}

export function formatLostReasonLegacyColumn(code: string, note?: string | null) {
  const label = code.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  if (note?.trim()) return `${label}: ${note.trim()}`;
  return label;
}

export function lostReasonOptions(status: "LOST" | "REJECTED") {
  const codes = status === "LOST" ? LOST_REASON_CODES : REJECTED_REASON_CODES;
  return codes.map((code) => ({
    code,
    label: lostReasonLabel(code, status),
  }));
}
