export type SpecFieldType = "select" | "number" | "text" | "file";

export type SpecFieldShowWhen = {
  key: string;
  match: RegExp | string | readonly string[];
};

export type ProductSpecField = {
  key: string;
  label: string;
  type: SpecFieldType;
  required?: boolean;
  unit?: string;
  /** Placeholder / helper for text and number inputs. */
  placeholder?: string;
  accept?: string;
  maxFiles?: number;
  maxBytes?: number;
  showWhen?: SpecFieldShowWhen;
};

export type ProductSpecConfig = {
  id: string;
  matchSkus: readonly string[];
  matchNames: readonly string[];
  hiddenKeys: readonly string[];
  fields: readonly ProductSpecField[];
};

export const ALWAYS_HIDDEN_SPEC_KEYS = [
  "categoryId",
  "categoryName",
  "productId",
  "productName",
  "productSku",
  "productVariantId",
  "variantDisplayName",
  "seedMetadata",
  "sku",
] as const;

/** Fields dropped from new lead items; old records may still contain them. */
export const DROPPED_FORM_SPEC_KEYS = [
  "packing",
  "profile",
  "supplyCondition",
  "innerDiameter",
  "innerDiameterMm",
  "outerDiameter",
  "outerDiameterMm",
  "compatibleUtensilType",
  "designForm",
  "edgeType",
  "productFormCoil",
] as const;

export const DESIGN_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const DESIGN_FILE_MAX_COUNT = 5;
export const DESIGN_FILE_ACCEPT = ".pdf,.dxf,.dwg,.png,.jpg,.jpeg";
export const DESIGN_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/dxf",
  "application/x-dxf",
  "image/vnd.dxf",
  "application/acad",
  "application/x-acad",
  "application/dwg",
  "application/x-dwg",
  "application/octet-stream",
]);
export const DESIGN_FILE_EXTENSIONS = new Set(["pdf", "dxf", "dwg", "png", "jpg", "jpeg"]);

const circleConfig: ProductSpecConfig = {
  id: "circle",
  matchSkus: ["SSM-MFG-CIRCLE", "CIRCLE"],
  matchNames: ["circle"],
  hiddenKeys: ["edgeType"],
  fields: [
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "finish", label: "Finish", type: "select", required: true },
    { key: "thickness", label: "Thickness", type: "select", required: true, unit: "mm" },
    { key: "diameter", label: "Diameter", type: "number", required: true, unit: "mm", placeholder: "Enter value in numbers" },
  ],
};

const farmaConfig: ProductSpecConfig = {
  id: "farma",
  matchSkus: [
    "SSM-MFG-FARMA",
    "SSM-MFG-JUG-FARMA",
    "SSM-MFG-BHOJANTHAAL-FARMA",
    "SSM-MFG-CUSTOM-UTENSIL-FARMA",
    "SSM-MFG-FARMA-UTENSILS",
    "FARMA",
    "FARMA-1",
  ],
  matchNames: ["farma", "jug farma", "bhojanthaal farma", "custom utensil farma", "farma design"],
  hiddenKeys: ["compatibleUtensilType", "designForm", "drawingReference", "dimensions"],
  fields: [
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "finish", label: "Finish", type: "select", required: true },
    { key: "thickness", label: "Thickness", type: "select", required: true, unit: "mm" },
    { key: "length", label: "Length", type: "number", required: true, unit: "mm" },
    { key: "breadth", label: "Breadth", type: "number", required: true, unit: "mm" },
    { key: "productionRemarks", label: "Production Remarks", type: "select" },
  ],
};

const laserCutFarmaConfig: ProductSpecConfig = {
  id: "laser_cut_farma",
  matchSkus: ["SSM-MFG-LASER-FARMA"],
  matchNames: ["laser cut farma"],
  hiddenKeys: [],
  fields: [
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "thickness", label: "Thickness", type: "select", required: true, unit: "mm" },
    { key: "finish", label: "Finish", type: "select", required: true },
    { key: "cutProfile", label: "Cut Profile", type: "text", required: true },
    { key: "dimensions", label: "Required dimensions", type: "text", required: true },
    { key: "designReference", label: "Design reference", type: "text", required: true },
    {
      key: "designFiles",
      label: "Upload design / drawing",
      type: "file",
      accept: DESIGN_FILE_ACCEPT,
      maxFiles: DESIGN_FILE_MAX_COUNT,
      maxBytes: DESIGN_FILE_MAX_BYTES,
    },
  ],
};

const sheetConfig: ProductSpecConfig = {
  id: "sheet",
  matchSkus: ["SSM-TRD-SHEET", "SSM-TRD-MIRROR-MATT-PVD", "SHEET", "PRD-2026-00001"],
  matchNames: ["sheet", "mirror, matt & pvd sheets"],
  hiddenKeys: ["pvdColour", "dimensions"],
  fields: [
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "finish", label: "Finish", type: "select", required: true },
    { key: "thickness", label: "Thickness", type: "select", required: true, unit: "mm" },
    { key: "width", label: "Width", type: "select", required: true, unit: "mm" },
    { key: "length", label: "Length", type: "select", required: true, unit: "mm" },
    {
      key: "decorativeSubtype",
      label: "Decorative Subtype",
      type: "select",
      showWhen: { key: "finish", match: /pvd|mirror|matt/i },
    },
  ],
};

const rodConfig: ProductSpecConfig = {
  id: "rod",
  matchSkus: ["SSM-TRD-ROD", "ROD"],
  matchNames: ["rod"],
  hiddenKeys: ["packing", "profile", "supplyCondition"],
  fields: [
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "diameter", label: "Diameter", type: "number", required: true, unit: "mm", placeholder: "Enter value in numbers" },
    { key: "length", label: "Length", type: "number", required: true, unit: "mm" },
  ],
};

const coilConfig: ProductSpecConfig = {
  id: "coil",
  matchSkus: ["SSM-TRD-COIL", "COIL"],
  matchNames: ["coil"],
  hiddenKeys: ["innerDiameterMm", "innerDiameter", "outerDiameterMm", "outerDiameter", "productForm"],
  fields: [
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "finish", label: "Finish", type: "select", required: true },
    { key: "thickness", label: "Thickness", type: "select", required: true, unit: "mm" },
    { key: "width", label: "Width", type: "select", required: true, unit: "mm" },
    // TODO: confirm whether Size Note should remain on Coil (handwritten "?" on the spec sheet).
    { key: "sizeNote", label: "Size Note", type: "text" },
  ],
};

const wireConfig: ProductSpecConfig = {
  id: "wire",
  matchSkus: ["SSM-TRD-WIRE", "SSM-TRD-WIRE-PCS", "WIRE"],
  matchNames: ["wire", "wire pcs"],
  hiddenKeys: ["packing"],
  fields: [
    { key: "productForm", label: "Product Form", type: "select", required: true },
    { key: "grade", label: "Grade", type: "select", required: true },
    { key: "wireDiameterMm", label: "Wire diameter", type: "number", required: true, unit: "mm" },
    { key: "finishOrCondition", label: "Finish / condition", type: "select", required: true },
    {
      key: "cutLengthMm",
      label: "Cut length",
      type: "number",
      required: true,
      unit: "mm",
      showWhen: { key: "productForm", match: /cut/i },
    },
  ],
};

const semiFinishUtensilsConfig: ProductSpecConfig = {
  id: "semi_finish_utensils",
  matchSkus: [
    "SSM-MFG-SEMI-FINISH-UTENSILS",
    "SSM-MFG-SEMI-FINISH-ICE-BUCKET",
    "SSM-MFG-SEMI-FINISH-CANISTER",
    "SSM-MFG-SEMI-FINISH-JUG",
  ],
  matchNames: [
    "semi finished utensils",
    "semi-finished utensils",
    "semi finish utensils",
    "semi finish ice bucket",
    "semi finish canister",
    "semi finish jug",
  ],
  hiddenKeys: [],
  fields: [
    { key: "grade", label: "Grade", type: "select" },
    { key: "stageOfManufacture", label: "Stage of Manufacture", type: "select" },
    { key: "utensilType", label: "Utensil Type", type: "select" },
  ],
};

export const PRODUCT_FIELD_CONFIG: readonly ProductSpecConfig[] = [
  circleConfig,
  farmaConfig,
  laserCutFarmaConfig,
  sheetConfig,
  rodConfig,
  coilConfig,
  wireConfig,
  semiFinishUtensilsConfig,
];

export function isProductComingSoon(product?: {
  sku?: string | null;
  name?: string | null;
} | null): boolean {
  if (!product) return false;
  const sku = product.sku?.trim().toUpperCase() ?? "";
  const name = product.name?.trim().toLowerCase() ?? "";
  return (
    sku === "SSM-MFG-SEMI-FINISH-UTENSILS" ||
    sku.startsWith("SSM-MFG-SEMI-FINISH-") ||
    /semi[\s_-]*finish/i.test(name)
  );
}

export const MERGED_PRODUCT_SKUS: Record<string, string> = {
  "SSM-TRD-WIRE-PCS": "SSM-TRD-WIRE",
  "SSM-TRD-MIRROR-MATT-PVD": "SSM-TRD-SHEET",
  "SSM-MFG-JUG-FARMA": "SSM-MFG-FARMA",
  "SSM-MFG-BHOJANTHAAL-FARMA": "SSM-MFG-FARMA",
  "SSM-MFG-CUSTOM-UTENSIL-FARMA": "SSM-MFG-FARMA",
  "SSM-MFG-FARMA-UTENSILS": "SSM-MFG-FARMA",
  "FARMA-1": "SSM-MFG-FARMA",
  "FARMA": "SSM-MFG-FARMA",
  "SSM-MFG-SEMI-FINISH-ICE-BUCKET": "SSM-MFG-SEMI-FINISH-UTENSILS",
  "SSM-MFG-SEMI-FINISH-CANISTER": "SSM-MFG-SEMI-FINISH-UTENSILS",
  "SSM-MFG-SEMI-FINISH-JUG": "SSM-MFG-SEMI-FINISH-UTENSILS",
};

const SPEC_LABELS: Record<string, string> = {
  grade: "Grade",
  finish: "Finish",
  thickness: "Thickness",
  width: "Width",
  length: "Length",
  breadth: "Breadth",
  diameter: "Diameter",
  wireDiameterMm: "Wire diameter",
  cutLengthMm: "Cut length",
  finishOrCondition: "Finish / condition",
  productForm: "Product Form",
  decorativeSubtype: "Decorative Subtype",
  sizeNote: "Size Note",
  productionRemarks: "Production Remarks",
  cutProfile: "Cut Profile",
  dimensions: "Required dimensions",
  designReference: "Design reference",
  designFiles: "Design files",
  drawingReference: "Drawing reference",
};

const SPEC_UNITS: Record<string, string> = {
  thickness: "mm",
  width: "mm",
  length: "mm",
  breadth: "mm",
  diameter: "mm",
  wireDiameterMm: "mm",
  cutLengthMm: "mm",
  innerDiameterMm: "mm",
  outerDiameterMm: "mm",
  capacityLitres: "L",
  weightPerPiece: "kg",
};

export function specFieldLabel(key: string) {
  if (SPEC_LABELS[key]) return SPEC_LABELS[key];
  return key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function specFieldUnit(key: string) {
  return SPEC_UNITS[key] ?? "";
}

export function resolveProductFieldConfig(product?: {
  sku?: string | null;
  name?: string | null;
} | null): ProductSpecConfig | null {
  if (!product) return null;
  const sku = product.sku?.trim().toUpperCase() ?? "";
  const name = product.name?.trim().toLowerCase() ?? "";
  return (
    PRODUCT_FIELD_CONFIG.find(
      (config) =>
        (sku && config.matchSkus.some((code) => code.toUpperCase() === sku)) ||
        (name && config.matchNames.includes(name)),
    ) ?? null
  );
}

export function fieldIsVisible(field: ProductSpecField, specs: Record<string, string>) {
  if (!field.showWhen) return true;
  const current = specs[field.showWhen.key] ?? "";
  const rule = field.showWhen.match;
  if (rule instanceof RegExp) return rule.test(current);
  if (typeof rule === "string") return current === rule;
  return rule.includes(current);
}

export function visibleProductFields(config: ProductSpecConfig, specs: Record<string, string>) {
  return config.fields.filter((field) => fieldIsVisible(field, specs));
}

export function requiredProductFields(config: ProductSpecConfig, specs: Record<string, string>) {
  return visibleProductFields(config, specs).filter((field) => field.required && field.type !== "file");
}

export function missingRequiredSpecFields(
  config: ProductSpecConfig,
  specs: Record<string, string>,
) {
  return requiredProductFields(config, specs)
    .filter((field) => {
      if (field.type === "file") return false;
      return !String(specs[field.key] ?? "").trim();
    })
    .map((field) => field.label);
}

export function isNumericSpecInput(key: string, config?: ProductSpecConfig | null) {
  const field = config?.fields.find((item) => item.key === key);
  if (field) return field.type === "number";
  return Boolean(SPEC_UNITS[key] && SPEC_UNITS[key] !== "L" ? true : ["weightPerPiece", "netWeightKg", "capacityLitres"].includes(key));
}

export function isFreeEntrySpecKey(key: string, config?: ProductSpecConfig | null) {
  const field = config?.fields.find((item) => item.key === key);
  if (!field) return key === "diameter";
  return field.type === "number" || field.type === "text" || field.type === "file";
}

export function variantMatchKeys(config: ProductSpecConfig, specs: Record<string, string>) {
  return visibleProductFields(config, specs)
    .filter((field) => field.type === "select")
    .map((field) => field.key);
}

export function isPositiveDecimal(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) return false;
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0;
}

export function invalidNumericSpecFields(
  config: ProductSpecConfig,
  specs: Record<string, string>,
) {
  return visibleProductFields(config, specs)
    .filter((field) => field.type === "number")
    .filter((field) => {
      const value = String(specs[field.key] ?? "").trim();
      if (!value) return Boolean(field.required);
      return !isPositiveDecimal(value);
    })
    .map((field) => field.label);
}

type VariantLike = {
  id: string;
  materialMasterId?: string | null;
  uom?: string;
  specs: Record<string, unknown>;
};

function specValue(specs: Record<string, unknown>, key: string) {
  const value = specs[key];
  if (value == null || typeof value === "object") return "";
  return String(value);
}

/**
 * Pick a catalog variant for UOM / material linking without requiring an exact
 * saved combination. Free numeric values and newly added select options never
 * disqualify a variant; they only affect the match score.
 */
export function findBestVariantForSpecs<T extends VariantLike>(
  variants: T[],
  specs: Record<string, string>,
  config: ProductSpecConfig | null,
): T | undefined {
  if (!variants.length) return undefined;
  if (!config) {
    const keys = Object.keys(specs).filter((key) => key !== "diameter" && !isFreeEntrySpecKey(key, null));
    const exact = variants.filter((variant) =>
      keys.every((key) => !specs[key] || specValue(variant.specs, key) === specs[key]),
    );
    return exact[0] ?? variants[0];
  }
  const keys = variantMatchKeys(config, specs);
  let best: T | undefined;
  let bestScore = -1;
  for (const variant of variants) {
    let score = 0;
    for (const key of keys) {
      const rawWanted = specs[key];
      const wanted = (typeof rawWanted === "string" ? rawWanted : String(rawWanted ?? "")).trim();
      if (!wanted) continue;
      const actual = specValue(variant.specs, key);
      if (actual === wanted) score += 3;
      else if (!actual) score += 0;
      else score += 0;
    }
    if (score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }
  return best ?? variants[0];
}

export function designFileExtension(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1)! : "";
}

export function isAllowedDesignFile(file: { name: string; type: string; size: number }) {
  const ext = designFileExtension(file.name);
  if (!DESIGN_FILE_EXTENSIONS.has(ext)) return false;
  if (file.size <= 0 || file.size > DESIGN_FILE_MAX_BYTES) return false;
  if (file.type && !DESIGN_FILE_MIME_TYPES.has(file.type) && file.type !== "application/octet-stream") {
    return false;
  }
  return true;
}

export function extractDesignFileIds(specs: Record<string, unknown> | undefined) {
  if (!specs) return [] as string[];
  const ids = specs.designFileIds;
  if (Array.isArray(ids)) {
    return ids.filter((value): value is string => typeof value === "string" && value.length > 0);
  }
  const files = specs.designFiles;
  if (Array.isArray(files)) {
    return files.flatMap((file) =>
      file && typeof file === "object" && "id" in file && typeof (file as { id: unknown }).id === "string"
        ? [(file as { id: string }).id]
        : [],
    );
  }
  return [];
}
