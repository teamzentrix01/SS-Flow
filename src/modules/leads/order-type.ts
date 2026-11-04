export const LEAD_ORDER_TYPES = ["READY_STOCK", "CUSTOM"] as const;
export type LeadOrderType = (typeof LEAD_ORDER_TYPES)[number];

export const LEAD_GRADE_OPTIONS = [
  "201",
  "202",
  "304",
  "304L",
  "316",
  "316L",
  "430",
  "Other",
] as const;

export const PRICING_BASIS_OPTIONS = ["PER_KG", "PER_PIECE"] as const;
export type PricingBasis = (typeof PRICING_BASIS_OPTIONS)[number];

export function normalizeLeadOrderType(value?: string | null): LeadOrderType {
  const key = (value ?? "READY_STOCK").trim().toUpperCase();
  if (key === "CUSTOM") return "CUSTOM";
  if (key === "STANDARD") return "READY_STOCK";
  return "READY_STOCK";
}

export function isCustomLeadOrder(orderType?: string | null) {
  return normalizeLeadOrderType(orderType) === "CUSTOM";
}

export function leadOrderTypeLabel(orderType?: string | null) {
  return isCustomLeadOrder(orderType) ? "Custom / made-to-order" : "Ready stock";
}
