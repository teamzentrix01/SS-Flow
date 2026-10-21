import { normalizeUom } from "./uom";

export type SteelSpecs = {
  grade?: string | null;
  thickness?: string | null;
  width?: string | null;
  length?: string | null;
  diameter?: string | null;
  finish?: string | null;
  productForm?: string | null;
};

const SPEC_KEYS = ["grade", "thickness", "width", "length", "diameter", "finish"] as const;

function normalized(key: (typeof SPEC_KEYS)[number], value: string | null | undefined) {
  if (value == null || !value.trim()) return null;
  const text = value.trim();
  if (key === "grade" || key === "finish") return text.toUpperCase();
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : text.toUpperCase();
}

/** Conservative compatibility: exact material identity, required category specs, and base UOM. */
export function checkMaterialCompatibility(input: {
  requestedMaterialId: string;
  actualMaterialId: string;
  requestedSpecs: SteelSpecs;
  actualSpecs: SteelSpecs;
  requiredSpecs: readonly string[];
  requestedUom: string;
  actualUom: string;
  substitutionApproved?: boolean;
}) {
  if (normalizeUom(input.requestedUom) !== normalizeUom(input.actualUom)) return "UOM_MISMATCH" as const;
  if (input.requestedMaterialId !== input.actualMaterialId && !input.substitutionApproved) return "SUBSTITUTION_REQUIRED" as const;
  if (input.requestedSpecs.productForm && input.actualSpecs.productForm && input.requestedSpecs.productForm.toUpperCase() !== input.actualSpecs.productForm.toUpperCase()) {
    return "PRODUCT_FORM_MISMATCH" as const;
  }
  for (const key of SPEC_KEYS) {
    if (!input.requiredSpecs.includes(key)) continue;
    const expected = normalized(key, input.requestedSpecs[key]);
    const actual = normalized(key, input.actualSpecs[key]);
    if (expected === null || actual === null) return "SPEC_MISSING" as const;
    if (expected !== actual && !input.substitutionApproved) return "SPEC_MISMATCH" as const;
  }
  return null;
}
