import { isCustomLeadOrder } from "@/modules/leads/order-type";

export const LEAD_SOURCES = [
  "WEBSITE",
  "VISIT",
  "PHONE",
  "REFERRAL",
  "INDIAMART",
  "JUSTDIAL",
  "WHATSAPP",
  "SOCIAL_MEDIA",
  "EMAIL",
  "EXHIBITION",
  "OTHER",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website",
  VISIT: "Visit",
  PHONE: "Phone call",
  REFERRAL: "Referral",
  INDIAMART: "IndiaMART",
  JUSTDIAL: "JustDial",
  WHATSAPP: "WhatsApp",
  SOCIAL_MEDIA: "Social media",
  EMAIL: "Email",
  EXHIBITION: "Exhibition",
  OTHER: "Other",
};

export function leadSourceLabel(source: string) {
  if (source in LEAD_SOURCE_LABELS) return LEAD_SOURCE_LABELS[source as LeadSource];
  return source.replaceAll("_", " ");
}

export const LEAD_PRIORITIES = ["HOT", "WARM", "COLD"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

const LEGACY_PRIORITY_LABELS: Record<string, LeadPriority | undefined> = {
  urgent: "HOT",
  high: "HOT",
  hot: "HOT",
  normal: "WARM",
  warm: "WARM",
  low: "COLD",
  cold: "COLD",
};

export function normalizeLeadPriority(value?: string | null): LeadPriority {
  if (!value) return "WARM";
  const upper = value.trim().toUpperCase();
  if (LEAD_PRIORITIES.includes(upper as LeadPriority)) return upper as LeadPriority;
  const legacy = LEGACY_PRIORITY_LABELS[value.trim().toLowerCase()];
  return legacy ?? "WARM";
}

export function leadPriorityLabel(priority: string) {
  const key = priority?.trim() || "WARM";
  const mapped = LEGACY_PRIORITY_LABELS[key.toLowerCase()] ?? key.toUpperCase();
  if (mapped === "HOT") return "Hot";
  if (mapped === "WARM") return "Warm";
  if (mapped === "COLD") return "Cold";
  return key.replaceAll("_", " ");
}

export { LEAD_ORDER_TYPES, type LeadOrderType, isCustomLeadOrder, leadOrderTypeLabel, normalizeLeadOrderType } from "@/modules/leads/order-type";

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "SAMPLE_APPROVAL",
  "CONVERTED",
  "ON_HOLD",
  "LOST",
  "REJECTED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Kept for historical records; not offered as a new manual stage. */
export const DEPRECATED_MANUAL_LEAD_STATUSES: readonly LeadStatus[] = ["VERIFICATION_PENDING"];

/** Pipeline order for UI: progress stages first, then hold / closed outcomes. */
export const LEAD_STATUS_FLOW_ORDER: readonly LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "SAMPLE_APPROVAL",
  "CONVERTED",
  "ON_HOLD",
  "LOST",
  "REJECTED",
];

export type LeadTransitionContext = {
  orderType?: string | null;
};

export const LEAD_STATUS_META: Record<
  LeadStatus,
  { label: string; description: string; kind: "progress" | "outcome" | "terminal" }
> = {
  NEW: {
    label: "New enquiry",
    description: "Enquiry received; not yet contacted",
    kind: "progress",
  },
  CONTACTED: {
    label: "Contacted",
    description: "First response made to the customer",
    kind: "progress",
  },
  FOLLOW_UP: {
    label: "Follow-up",
    description: "Awaiting customer reply or clarification",
    kind: "progress",
  },
  VERIFICATION_PENDING: {
    label: "Ready for verification (legacy)",
    description: "Older stage — use verification checklist directly",
    kind: "progress",
  },
  VERIFIED: {
    label: "Qualified",
    description: "Requirement confirmed; ready to quote or convert",
    kind: "progress",
  },
  QUOTATION_SENT: {
    label: "Quotation sent",
    description: "Commercial offer shared with the customer",
    kind: "progress",
  },
  NEGOTIATION: {
    label: "Negotiation",
    description: "Price, terms or delivery under discussion",
    kind: "progress",
  },
  SAMPLE_APPROVAL: {
    label: "Sample approval",
    description: "Awaiting customer approval on sample (custom orders)",
    kind: "progress",
  },
  CONVERTED: {
    label: "Converted to sales order",
    description: "Lead closed as a won order",
    kind: "terminal",
  },
  ON_HOLD: {
    label: "On hold",
    description: "Paused; resume when the customer is ready",
    kind: "outcome",
  },
  LOST: {
    label: "Lost",
    description: "Customer did not proceed",
    kind: "outcome",
  },
  REJECTED: {
    label: "Rejected",
    description: "Not a valid or workable enquiry",
    kind: "outcome",
  },
};

export function leadStatusLabel(status: string) {
  if (status in LEAD_STATUS_META) {
    return LEAD_STATUS_META[status as LeadStatus].label;
  }
  return status.replaceAll("_", " ");
}

export function leadStatusDescription(status: string) {
  if (status in LEAD_STATUS_META) {
    return LEAD_STATUS_META[status as LeadStatus].description;
  }
  return "";
}

export function leadStatusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const key = status.toUpperCase();
  if (key === "CONVERTED") return "success";
  if (["LOST", "REJECTED"].includes(key)) return "danger";
  if (["ON_HOLD", "VERIFICATION_PENDING", "SAMPLE_APPROVAL"].includes(key)) return "warning";
  if (["NEGOTIATION", "QUOTATION_SENT", "FOLLOW_UP"].includes(key)) return "info";
  if (key === "VERIFIED") return "info";
  return "neutral";
}

function sampleApprovalAllowed(ctx?: LeadTransitionContext) {
  return isCustomLeadOrder(ctx?.orderType);
}

/** Statuses the desk can set manually (verify / convert use dedicated actions). */
export function manualLeadStatusOptions(from: string, orderType?: string | null): LeadStatus[] {
  const ctx = { orderType };
  return LEAD_STATUS_FLOW_ORDER.filter(
    (value) =>
      value !== from &&
      value !== "VERIFIED" &&
      value !== "CONVERTED" &&
      value !== "NEW" &&
      !DEPRECATED_MANUAL_LEAD_STATUSES.includes(value) &&
      canTransitionLead(from, value, ctx),
  );
}

const TERMINAL: LeadStatus[] = ["CONVERTED", "LOST", "REJECTED"];

const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "FOLLOW_UP", "ON_HOLD", "LOST", "REJECTED"],
  CONTACTED: ["FOLLOW_UP", "QUOTATION_SENT", "ON_HOLD", "LOST", "REJECTED"],
  FOLLOW_UP: ["CONTACTED", "QUOTATION_SENT", "ON_HOLD", "LOST", "REJECTED"],
  VERIFICATION_PENDING: ["CONTACTED", "ON_HOLD", "LOST", "REJECTED"],
  VERIFIED: ["QUOTATION_SENT", "CONVERTED", "ON_HOLD", "LOST", "REJECTED"],
  QUOTATION_SENT: ["NEGOTIATION", "VERIFIED", "CONVERTED", "FOLLOW_UP", "ON_HOLD", "LOST", "REJECTED", "SAMPLE_APPROVAL"],
  NEGOTIATION: ["QUOTATION_SENT", "CONVERTED", "FOLLOW_UP", "ON_HOLD", "LOST", "REJECTED", "SAMPLE_APPROVAL"],
  SAMPLE_APPROVAL: ["NEGOTIATION", "CONVERTED", "LOST"],
  CONVERTED: [],
  ON_HOLD: ["CONTACTED", "FOLLOW_UP", "LOST", "REJECTED"],
  LOST: ["CONTACTED", "FOLLOW_UP"],
  REJECTED: ["CONTACTED", "FOLLOW_UP"],
};

function transitionAllowed(from: LeadStatus, to: LeadStatus, ctx?: LeadTransitionContext) {
  if (to === "SAMPLE_APPROVAL" || from === "SAMPLE_APPROVAL") {
    if (!sampleApprovalAllowed(ctx)) return false;
  }
  if (to === "SAMPLE_APPROVAL" && !["QUOTATION_SENT", "NEGOTIATION"].includes(from)) {
    return false;
  }
  return TRANSITIONS[from].includes(to);
}

export function canTransitionLead(from: string, to: LeadStatus, ctx?: LeadTransitionContext): boolean {
  if (!LEAD_STATUSES.includes(from as LeadStatus)) return false;
  const current = from as LeadStatus;
  if (current === to) return true;
  if (TERMINAL.includes(current) && to !== current) {
    return from === "LOST" || from === "REJECTED" ? TRANSITIONS[current].includes(to) : false;
  }
  return transitionAllowed(current, to, ctx);
}

export function assertLeadTransition(from: string, to: LeadStatus, ctx?: LeadTransitionContext) {
  if (!canTransitionLead(from, to, ctx)) {
    if (
      (to === "SAMPLE_APPROVAL" || from === "SAMPLE_APPROVAL") &&
      !sampleApprovalAllowed(ctx)
    ) {
      throw new Error(`INVALID_LEAD_TRANSITION:${from}->${to}:CUSTOM_REQUIRED`);
    }
    throw new Error(`INVALID_LEAD_TRANSITION:${from}->${to}`);
  }
}

export function leadRequiresLostReason(to: LeadStatus) {
  return to === "LOST" || to === "REJECTED";
}

export function leadCanVerify(status: string) {
  return ["VERIFICATION_PENDING", "CONTACTED", "FOLLOW_UP", "NEW", "ON_HOLD"].includes(status);
}

export function leadCanConvert(status: string) {
  return (
    status === "VERIFIED" ||
    status === "QUOTATION_SENT" ||
    status === "NEGOTIATION" ||
    status === "SAMPLE_APPROVAL"
  );
}
