export const LEAD_SOURCES = ["WEBSITE", "VISIT", "PHONE", "REFERRAL", "OTHER"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "QUOTATION_SENT",
  "CONVERTED",
  "ON_HOLD",
  "LOST",
  "REJECTED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const TERMINAL: LeadStatus[] = ["CONVERTED", "LOST", "REJECTED"];

const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "FOLLOW_UP", "VERIFICATION_PENDING", "VERIFIED", "ON_HOLD", "LOST", "REJECTED"],
  CONTACTED: ["FOLLOW_UP", "VERIFICATION_PENDING", "VERIFIED", "QUOTATION_SENT", "ON_HOLD", "LOST", "REJECTED"],
  FOLLOW_UP: ["CONTACTED", "VERIFICATION_PENDING", "VERIFIED", "QUOTATION_SENT", "ON_HOLD", "LOST", "REJECTED"],
  VERIFICATION_PENDING: ["VERIFIED", "CONTACTED", "ON_HOLD", "LOST", "REJECTED"],
  VERIFIED: ["QUOTATION_SENT", "CONVERTED", "ON_HOLD", "LOST", "REJECTED"],
  QUOTATION_SENT: ["VERIFIED", "CONVERTED", "FOLLOW_UP", "ON_HOLD", "LOST", "REJECTED"],
  CONVERTED: [],
  ON_HOLD: ["CONTACTED", "FOLLOW_UP", "VERIFICATION_PENDING", "VERIFIED", "LOST", "REJECTED"],
  LOST: ["CONTACTED", "FOLLOW_UP"],
  REJECTED: ["CONTACTED", "FOLLOW_UP"],
};

export function canTransitionLead(from: string, to: LeadStatus): boolean {
  if (!LEAD_STATUSES.includes(from as LeadStatus)) return false;
  const current = from as LeadStatus;
  if (current === to) return true;
  if (TERMINAL.includes(current) && to !== current) {
    return from === "LOST" || from === "REJECTED" ? TRANSITIONS[current].includes(to) : false;
  }
  return TRANSITIONS[current].includes(to);
}

export function assertLeadTransition(from: string, to: LeadStatus) {
  if (!canTransitionLead(from, to)) {
    throw new Error(`INVALID_LEAD_TRANSITION:${from}->${to}`);
  }
}

export function leadRequiresLostReason(to: LeadStatus) {
  return to === "LOST" || to === "REJECTED";
}

export function leadCanVerify(status: string) {
  return ["VERIFICATION_PENDING", "CONTACTED", "FOLLOW_UP", "NEW"].includes(status);
}

export function leadCanConvert(status: string) {
  return status === "VERIFIED" || status === "QUOTATION_SENT";
}
