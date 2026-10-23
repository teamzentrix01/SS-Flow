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

export const TRADING_PRODUCT_TYPES = [
  { value: "coil", label: "Coil" },
  { value: "sheet", label: "Sheet" },
  { value: "mirror_sheet", label: "Mirror Sheet" },
  { value: "matt_sheet", label: "Matt Sheet" },
  { value: "pvd_sheet", label: "PVD Sheet" },
  { value: "rod", label: "Rod" },
  { value: "wire", label: "Wire" },
  { value: "other", label: "Other trading product" },
] as const;

export const MANUFACTURED_PRODUCT_TYPES = [
  { value: "laser_cut_farma", label: "Laser Cut Farma" },
  { value: "circle", label: "Circle" },
  { value: "semi_finished_utensils", label: "Semi-Finished Utensils" },
  { value: "finished_utensils", label: "Finished Utensils" },
  { value: "custom_farma", label: "Custom Farma" },
] as const;

export const FINISH_OPTIONS = ["2B", "2D", "BA", "Hairline", "Mirror", "Matt", "Satin"] as const;
export const PVD_COLOUR_OPTIONS = ["Gold", "Rose Gold", "Black", "Champagne", "Copper", "Bronze"] as const;
export const GRADE_OPTIONS = ["SS 202", "SS 304", "SS 316", "Other"] as const;

export type ProductSpecificationKey =
  | "materialFamily"
  | "grade"
  | "finish"
  | "thickness"
  | "width"
  | "length"
  | "diameter"
  | "quantityPackDetails"
  | "coilReference"
  | "netWeightKg"
  | "innerDiameter"
  | "outerDiameter"
  | "pvdColour"
  | "wireGauge"
  | "bundleReference"
  | "shapeDesign"
  | "drawingReference"
  | "productionRemarks"
  | "height"
  | "capacityLitres"
  | "requiredDimensions"
  | "components"
  | "customizationNotes";

export type ProductSpecificationValues = Partial<Record<ProductSpecificationKey, string>>;

export const TRADING_SPEC_FIELDS: Record<string, { key: ProductSpecificationKey; label: string; unit?: string }[]> = {
  coil: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Finish" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "width", label: "Width", unit: "mm" },
    { key: "coilReference", label: "Coil reference" },
    { key: "netWeightKg", label: "Net weight", unit: "kg" },
    { key: "innerDiameter", label: "Inner diameter", unit: "mm" },
    { key: "outerDiameter", label: "Outer diameter", unit: "mm" },
    { key: "quantityPackDetails", label: "Quantity / pack details" },
  ],
  sheet: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Finish" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "width", label: "Width", unit: "mm" },
    { key: "length", label: "Length", unit: "mm" },
    { key: "quantityPackDetails", label: "Quantity / pack details" },
  ],
  mirror_sheet: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Surface finish" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "width", label: "Width", unit: "mm" },
    { key: "length", label: "Length", unit: "mm" },
  ],
  matt_sheet: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Surface finish" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "width", label: "Width", unit: "mm" },
    { key: "length", label: "Length", unit: "mm" },
  ],
  pvd_sheet: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Finish" },
    { key: "pvdColour", label: "PVD colour" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "width", label: "Width", unit: "mm" },
    { key: "length", label: "Length", unit: "mm" },
  ],
  rod: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Finish" },
    { key: "diameter", label: "Diameter", unit: "mm" },
    { key: "length", label: "Length", unit: "mm" },
    { key: "quantityPackDetails", label: "Quantity / pack details" },
  ],
  wire: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Finish" },
    { key: "diameter", label: "Wire diameter", unit: "mm" },
    { key: "wireGauge", label: "Wire gauge" },
    { key: "bundleReference", label: "Coil / bundle reference" },
    { key: "netWeightKg", label: "Net weight", unit: "kg" },
  ],
  other: [
    { key: "materialFamily", label: "Material family" },
    { key: "grade", label: "Grade" },
    { key: "finish", label: "Finish" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "quantityPackDetails", label: "Quantity / pack details" },
  ],
};

export const MANUFACTURED_SPEC_FIELDS: Record<string, { key: ProductSpecificationKey; label: string; unit?: string }[]> = {
  laser_cut_farma: [
    { key: "materialFamily", label: "Raw material family" },
    { key: "grade", label: "Raw material grade" },
    { key: "thickness", label: "Material thickness", unit: "mm" },
    { key: "requiredDimensions", label: "Sheet dimensions" },
    { key: "shapeDesign", label: "Shape / design" },
    { key: "drawingReference", label: "Drawing reference / attachment" },
    { key: "productionRemarks", label: "Production remarks" },
  ],
  circle: [
    { key: "materialFamily", label: "Raw material family" },
    { key: "grade", label: "Grade" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "diameter", label: "Diameter", unit: "mm" },
    { key: "finish", label: "Finish" },
  ],
  semi_finished_utensils: [
    { key: "materialFamily", label: "Raw material family" },
    { key: "grade", label: "Grade" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "diameter", label: "Diameter", unit: "mm" },
    { key: "height", label: "Height", unit: "mm" },
    { key: "capacityLitres", label: "Capacity", unit: "litres" },
    { key: "finish", label: "Finish" },
  ],
  finished_utensils: [
    { key: "materialFamily", label: "Raw material family" },
    { key: "grade", label: "Grade" },
    { key: "thickness", label: "Thickness", unit: "mm" },
    { key: "diameter", label: "Diameter", unit: "mm" },
    { key: "height", label: "Height", unit: "mm" },
    { key: "capacityLitres", label: "Capacity", unit: "litres" },
    { key: "finish", label: "Finish" },
  ],
  custom_farma: [
    { key: "materialFamily", label: "Raw material family" },
    { key: "grade", label: "Raw material grade" },
    { key: "requiredDimensions", label: "Required dimensions" },
    { key: "drawingReference", label: "Design / drawing reference" },
    { key: "components", label: "Components" },
    { key: "customizationNotes", label: "Customization notes" },
    { key: "productionRemarks", label: "Production remarks" },
  ],
  other: [
    { key: "materialFamily", label: "Raw material family" },
    { key: "grade", label: "Raw material grade" },
    { key: "thickness", label: "Material thickness", unit: "mm" },
    { key: "finish", label: "Finish" },
    { key: "productionRemarks", label: "Production remarks" },
  ],
};

export function getSpecFieldsForProductType(businessKind: "trading" | "manufactured", productType: string): MaterialSpecKey[] {
  if (businessKind === "trading") {
    switch (productType) {
      case "coil":
        return ["grade", "thickness", "width", "weightPerPiece"];
      case "sheet":
      case "mirror_sheet":
      case "matt_sheet":
        return ["grade", "thickness", "width", "length"];
      case "pvd_sheet":
        return ["grade", "thickness", "width", "length"];
      case "rod":
        return ["grade", "diameter", "length", "weightPerPiece"];
      case "wire":
        return ["grade", "diameter", "weightPerPiece"];
      case "pcs":
        return ["grade", "thickness", "diameter", "length", "weightPerPiece"];
      default:
        return ["grade", "thickness"];
    }
  } else {
    switch (productType) {
      case "laser_cut_farma":
        return ["grade", "thickness", "width", "length", "weightPerPiece"];
      case "circle":
        return ["grade", "thickness", "diameter", "weightPerPiece"];
      case "semi_finished_utensils":
        return ["grade", "thickness", "diameter", "weightPerPiece"];
      case "finished_utensils":
      case "custom_farma":
        return ["grade", "thickness", "diameter", "length", "weightPerPiece"];
      default:
        return ["grade", "thickness"];
    }
  }
}

export function missingMaterialSpecifications(
  required: readonly string[],
  values: MaterialSpecValues,
) {
  const fields = new Map<string, string>(MATERIAL_SPEC_FIELDS.map((field) => [field.key, field.label]));
  return required
    .filter((key) => fields.has(key) && !values[key as MaterialSpecKey]?.trim())
    .map((key) => fields.get(key)!);
}
