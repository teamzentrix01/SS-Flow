export const MATERIAL_SPEC_FIELDS = [
  { key: "grade", label: "Grade", unit: "" },
  { key: "thickness", label: "Thickness", unit: "mm" },
  { key: "width", label: "Width", unit: "mm" },
  { key: "length", label: "Length", unit: "mm" },
  { key: "diameter", label: "Diameter", unit: "mm" },
  { key: "weightPerPiece", label: "Weight per piece", unit: "kg" },
] as const;

export type MaterialSpecKey = (typeof MATERIAL_SPEC_FIELDS)[number]["key"];
export type MaterialSpecValues = Partial<Record<MaterialSpecKey, string | null | undefined>>;

export function missingMaterialSpecifications(
  required: readonly string[],
  values: MaterialSpecValues,
) {
  const fields = new Map<string, string>(MATERIAL_SPEC_FIELDS.map((field) => [field.key, field.label]));
  return required
    .filter((key) => fields.has(key) && !values[key as MaterialSpecKey]?.trim())
    .map((key) => fields.get(key)!);
}
