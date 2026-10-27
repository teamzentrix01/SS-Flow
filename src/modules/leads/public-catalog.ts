import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import {
  MANUFACTURED_SPEC_FIELDS,
  MATERIAL_SPEC_FIELDS,
  TRADING_SPEC_FIELDS,
} from "@/lib/domain/material-specifications";
import { resolvePublicLeadPlant } from "@/modules/leads/public-enquiry";

const PUBLIC_CATEGORY_TYPES = new Set([
  "raw_material",
  "wip",
  "finished_goods",
]);
const SPEC_LABELS = new Map<string, { label: string; unit: string }>(
  MATERIAL_SPEC_FIELDS.map(({ key, label, unit }) => [key, { label, unit }]),
);
export const PUBLIC_PRODUCT_SPEC_KEYS = new Set([
  "materialFamily",
  "finish",
  "quantityPackDetails",
  "coilReference",
  "netWeightKg",
  "innerDiameter",
  "outerDiameter",
  "pvdColour",
  "wireGauge",
  "bundleReference",
  "shapeDesign",
  "height",
  "capacityLitres",
  "innerDiameterMm",
  "outerDiameterMm",
  "productForm",
  "decorativeSubtype",
  "profile",
  "supplyCondition",
  "packing",
  "dimensions",
  "wireDiameterMm",
  "cutLengthMm",
  "finishOrCondition",
  "designReference",
  "cutProfile",
  "utensilType",
  "stageOfManufacture",
  "materialGrade",
  "designForm",
  "compatibleUtensilType",
  "drawingReference",
]);
const ALL_PRODUCT_SPEC_FIELDS = [
  ...Object.values(TRADING_SPEC_FIELDS),
  ...Object.values(MANUFACTURED_SPEC_FIELDS),
].flat();
const EXTRA_SPEC_LABELS = new Map(
  ALL_PRODUCT_SPEC_FIELDS.map(({ key, label, unit }) => [
    key,
    { label, unit: unit ?? "" },
  ]),
);
const PUBLIC_SPEC_LABELS = new Map<string, { label: string; unit: string }>([
  ["innerDiameterMm", { label: "Inner diameter", unit: "mm" }],
  ["outerDiameterMm", { label: "Outer diameter", unit: "mm" }],
  ["wireDiameterMm", { label: "Wire diameter", unit: "mm" }],
  ["cutLengthMm", { label: "Cut length", unit: "mm" }],
  ["finishOrCondition", { label: "Finish / condition", unit: "" }],
  ["productForm", { label: "Product form", unit: "" }],
  ["decorativeSubtype", { label: "Decorative type", unit: "" }],
  ["supplyCondition", { label: "Supply condition", unit: "" }],
  ["designReference", { label: "Design / drawing reference", unit: "" }],
  ["cutProfile", { label: "Cut profile", unit: "" }],
  ["utensilType", { label: "Utensil type", unit: "" }],
  ["stageOfManufacture", { label: "Stage of manufacture", unit: "" }],
  ["materialGrade", { label: "Material grade", unit: "" }],
  ["designForm", { label: "Design form", unit: "" }],
  ["compatibleUtensilType", { label: "Compatible utensil", unit: "" }],
  ["dimensions", { label: "Required dimensions", unit: "" }],
]);
const NUMERIC_SPEC_KEYS = new Set([
  "thickness",
  "width",
  "length",
  "diameter",
  "weightPerPiece",
  "netWeightKg",
  "innerDiameter",
  "outerDiameter",
  "wireGauge",
  "height",
  "capacityLitres",
  "innerDiameterMm",
  "outerDiameterMm",
  "wireDiameterMm",
  "cutLengthMm",
]);
const CUSTOMER_INPUT_SPEC_KEYS = new Set([
  "pvdColour",
  "dimensions",
  "requiredDimensions",
  "drawingReference",
  "designReference",
  "cutProfile",
  "wireGauge",
  "wireDiameterMm",
  "cutLengthMm",
  "finishOrCondition",
  "capacityLitres",
  "materialGrade",
  "thickness",
  "width",
  "length",
  "diameter",
  "finish",
  "packing",
]);
const CONFIGURABLE_VALUE =
  /^(confirm|configure|customer specified|customer supplied|customer drawing|optional\b|per approved)/i;
const SEEDED_SPEC_OVERRIDES: Record<string, Record<string, string>> = {
  "SSM-TRD-WIRE-V-304-WIRE-CONFIG": {
    productForm: "wire",
    wireDiameterMm: "confirm per order",
    finishOrCondition: "confirm per order",
    packing: "confirm per order",
  },
  "SSM-TRD-WIRE-V-316-WIRE-CONFIG": {
    productForm: "wire",
    wireDiameterMm: "confirm per order",
    finishOrCondition: "confirm per order",
    packing: "confirm per order",
  },
  "SSM-MFG-SEMI-FINISH-UTENSILS-V-ICE-BUCKET-CONFIG": {
    utensilType: "Ice Bucket",
    stageOfManufacture: "semi-finished; define per process",
    dimensions: "configure by design",
    capacityLitres: "optional; configure when relevant",
    materialGrade: "configure per order",
    thickness: "configure per order",
    finish: "configure per order",
  },
  "SSM-MFG-FARMA-UTENSILS-V-JUG-FARMA-CONFIG": {
    designForm: "Jug Farma",
    compatibleUtensilType: "Jug",
    dimensions: "customer drawing / approved design",
    drawingReference: "customer supplied",
    finish: "configure per order",
  },
};
const PRIVATE_SPEC_KEY =
  /(price|cost|margin|supplier|stock|inventory|internal|remark|note|demo)/i;
function isPublicSpecificationKey(key: string) {
  return (
    /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) &&
    !PRIVATE_SPEC_KEY.test(key) &&
    !/^seedMetadata$/i.test(key)
  );
}

export function publicSpecificationAllowsCustomerInput(
  key: string,
  value: string,
) {
  return (
    CUSTOMER_INPUT_SPEC_KEYS.has(key) && CONFIGURABLE_VALUE.test(value.trim())
  );
}

export function publicSpecificationIsNumeric(key: string) {
  return NUMERIC_SPEC_KEYS.has(key);
}

export function normalizePublicProductSpecs(sku: string, specs: unknown) {
  const stored =
    specs && typeof specs === "object" && !Array.isArray(specs)
      ? (specs as Record<string, unknown>)
      : {};
  return { ...stored, ...(SEEDED_SPEC_OVERRIDES[sku] ?? {}) };
}

export function eligiblePublicCategoryIds(
  rows: {
    id: string;
    code: string;
    parentId: string | null;
    status: string;
    categoryType: string;
  }[],
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const eligible = new Set<string>();
  for (const row of rows) {
    if (
      row.status.toLowerCase() !== "active" ||
      !PUBLIC_CATEGORY_TYPES.has(row.categoryType)
    )
      continue;
    let current: typeof row | undefined = row;
    let rootKind: "TRADING" | "MFG" | null = null;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.status.toLowerCase() !== "active") break;
      const code = current.code.trim().toUpperCase();
      if (code === "TRADING" || code === "MFG") {
        rootKind = code;
        break;
      }
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (rootKind && row.code.trim().toUpperCase() !== rootKind)
      eligible.add(row.id);
  }
  return eligible;
}

async function publicPlant() {
  const plant = await resolvePublicLeadPlant();
  const categories = await prisma.productCategory.findMany({
    where: { plantId: plant.id },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      categoryType: true,
      productForm: true,
      requiredSpecs: true,
      status: true,
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
  const eligibleIds = eligiblePublicCategoryIds(categories);
  return { plant, categories, eligibleIds };
}

export async function publicCategoryIsEligible(
  db: typeof prisma | import("@prisma/client").Prisma.TransactionClient,
  plantId: string,
  categoryId: string,
) {
  const rows = await db.productCategory.findMany({
    where: { plantId },
    select: {
      id: true,
      code: true,
      parentId: true,
      status: true,
      categoryType: true,
    },
  });
  if (eligiblePublicCategoryIds(rows).has(categoryId)) return true;
  const category = rows.find((row) => row.id === categoryId);
  return Boolean(
    category &&
    category.status.toLowerCase() === "active" &&
    PUBLIC_CATEGORY_TYPES.has(category.categoryType) &&
    ["TRADING", "MFG"].includes(category.code.trim().toUpperCase()),
  );
}

export async function getPublicEnquiryCategories() {
  const { plant, categories } = await publicPlant();
  const roots = categories.filter(
    (category) =>
      !category.parentId &&
      ["TRADING", "MFG"].includes(category.code.trim().toUpperCase()) &&
      category.status.toLowerCase() === "active",
  );
  if (!roots.length) return [];
  const grouped = await prisma.materialMaster.groupBy({
    by: ["categoryId"],
    where: {
      plantId: plant.id,
      categoryId: { in: roots.map((root) => root.id) },
      active: true,
      salesAllowed: true,
      isDemo: false,
    },
    _count: { _all: true },
  });
  const productCounts = new Map(
    grouped.map((row) => [row.categoryId, row._count._all]),
  );
  return roots
    .filter((category) => (productCounts.get(category.id) ?? 0) > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      code: category.code,
      productForm: category.productForm,
      requiredSpecs: category.requiredSpecs.filter((key) =>
        SPEC_LABELS.has(key),
      ),
    }));
}

export async function getPublicEnquiryProducts(
  categoryId: string,
  query: string,
  page: number,
) {
  const { plant, categories, eligibleIds } = await publicPlant();
  const category = categories.find((row) => row.id === categoryId);
  const isActiveRoot = Boolean(
    category &&
    category.status.toLowerCase() === "active" &&
    ["TRADING", "MFG"].includes(category.code.trim().toUpperCase()),
  );
  if (!category || (!eligibleIds.has(categoryId) && !isActiveRoot))
    throw new AppError(404, "NOT_FOUND", "Product category is not available.");
  const where = {
    plantId: plant.id,
    categoryId,
    active: true,
    salesAllowed: true,
    isDemo: false,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { code: { contains: query, mode: "insensitive" as const } },
            { grade: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const rows = await prisma.materialMaster.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      grade: true,
      thickness: true,
      width: true,
      length: true,
      diameter: true,
      weightPerPiece: true,
      specs: true,
      uom: true,
      salesUom: true,
      productVariant: {
        select: {
          id: true,
          isActive: true,
          grade: true,
          thicknessMm: true,
          widthMm: true,
          lengthMm: true,
          diameterMm: true,
          finish: true,
          unit: { select: { symbol: true, isActive: true } },
        },
      },
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
    skip: (page - 1) * 50,
    take: 51,
  });
  const products = rows.slice(0, 50).map((row) => {
    const variant = row.productVariant?.isActive ? row.productVariant : null;
    const rawSpecs =
      row.specs && typeof row.specs === "object" && !Array.isArray(row.specs)
        ? (row.specs as Record<string, unknown>)
        : {};
    const source: Record<string, unknown> = {
      ...rawSpecs,
      grade: row.grade ?? variant?.grade ?? rawSpecs.grade,
      thickness:
        row.thickness?.toString() ??
        variant?.thicknessMm?.toString() ??
        rawSpecs.thickness,
      width:
        row.width?.toString() ?? variant?.widthMm?.toString() ?? rawSpecs.width,
      length:
        row.length?.toString() ??
        variant?.lengthMm?.toString() ??
        rawSpecs.length,
      diameter:
        row.diameter?.toString() ??
        variant?.diameterMm?.toString() ??
        rawSpecs.diameter,
      weightPerPiece: row.weightPerPiece?.toString() ?? rawSpecs.weightPerPiece,
      finish: variant?.finish ?? rawSpecs.finish,
    };
    const keys = new Set([
      ...category.requiredSpecs,
      ...Object.entries(source)
        .filter(
          ([key, value]) =>
            (SPEC_LABELS.has(key) || key === "finish") &&
            value !== null &&
            value !== undefined &&
            value !== "",
        )
        .map(([key]) => key),
    ]);
    const specifications = [...keys]
      .filter((key) => SPEC_LABELS.has(key) || key === "finish")
      .map((key) => {
        const value = source[key];
        const configured =
          value === null ||
          value === undefined ||
          value === "" ||
          (typeof value !== "string" && typeof value !== "number")
            ? ""
            : String(value);
        const meta = SPEC_LABELS.get(key);
        return {
          key,
          label: meta?.label ?? "Finish",
          unit: meta?.unit ?? "",
          required: category.requiredSpecs.includes(key),
          value: configured,
        };
      });
    const uom = variant?.unit?.isActive
      ? variant.unit.symbol
      : row.salesUom || row.uom;
    const labelSpecs = specifications
      .filter((field) => field.value)
      .map(
        (field) =>
          `${field.label} ${field.value}${field.unit ? ` ${field.unit}` : ""}`,
      );
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      categoryId,
      productVariantId: variant?.id ?? null,
      uom,
      label: [row.name, row.code, ...labelSpecs].filter(Boolean).join(" · "),
      specifications,
    };
  });
  return {
    category: { id: category.id, name: category.name },
    products,
    page,
    pageSize: 50,
    hasMore: rows.length > 50,
  };
}

const PRODUCT_FORM_BY_SHAPE: Record<string, string> = {
  coil: "coil",
  sheet: "sheet",
  decorative_sheet: "mirror_sheet",
  round_wire_rod: "rod",
  wire: "wire",
  wire_piece: "wire",
  laser_cut_component: "laser_cut_farma",
  circle_blank: "circle",
  semi_finished_utensil: "semi_finished_utensils",
  utensil_farma_component: "custom_farma",
};

function productSpecTemplate(
  productForm: string | null,
  shape: string | null,
  categoryType: string,
  productType: string,
) {
  const resolvedForm =
    productForm || (shape ? PRODUCT_FORM_BY_SHAPE[shape] : null);
  if (resolvedForm && TRADING_SPEC_FIELDS[resolvedForm])
    return TRADING_SPEC_FIELDS[resolvedForm];
  if (resolvedForm && MANUFACTURED_SPEC_FIELDS[resolvedForm])
    return MANUFACTURED_SPEC_FIELDS[resolvedForm];
  if (resolvedForm === "utensil") {
    const key =
      productType === "semi_finished"
        ? "semi_finished_utensils"
        : "finished_utensils";
    return MANUFACTURED_SPEC_FIELDS[key];
  }
  if (categoryType === "raw_material") return TRADING_SPEC_FIELDS.other;
  return [];
}

export function productSpecifications(input: {
  productForm: string | null;
  shape?: string | null;
  categoryType: string;
  productType: string;
  requiredSpecs: string[];
  grade: string | null;
  thickness: { toString(): string } | null;
  width: { toString(): string } | null;
  length: { toString(): string } | null;
  diameter: { toString(): string } | null;
  weightPerPiece: { toString(): string } | null;
  variant: {
    grade: string | null;
    thicknessMm: { toString(): string } | null;
    widthMm: { toString(): string } | null;
    lengthMm: { toString(): string } | null;
    diameterMm: { toString(): string } | null;
    finish: string | null;
  } | null;
  specs: unknown;
}) {
  const stored =
    input.specs &&
    typeof input.specs === "object" &&
    !Array.isArray(input.specs)
      ? (input.specs as Record<string, unknown>)
      : {};
  const values: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      const normalized = String(value).trim();
      if (normalized) values[key] = normalized;
    }
  };
  for (const [key, value] of Object.entries(stored)) {
    if (isPublicSpecificationKey(key)) put(key, value);
  }
  put("grade", input.grade ?? input.variant?.grade ?? values.grade);
  put(
    "thickness",
    input.thickness?.toString() ??
      input.variant?.thicknessMm?.toString() ??
      values.thickness,
  );
  put(
    "width",
    input.width?.toString() ??
      input.variant?.widthMm?.toString() ??
      values.width,
  );
  put(
    "length",
    input.length?.toString() ??
      input.variant?.lengthMm?.toString() ??
      values.length,
  );
  put(
    "diameter",
    input.diameter?.toString() ??
      input.variant?.diameterMm?.toString() ??
      values.diameter,
  );
  put(
    "weightPerPiece",
    input.weightPerPiece?.toString() ?? values.weightPerPiece,
  );
  put("finish", input.variant?.finish ?? values.finish);

  const template = productSpecTemplate(
    input.productForm,
    input.shape ?? null,
    input.categoryType,
    input.productType,
  );
  const labels = new Map<string, { label: string; unit: string }>(
    template.map(({ key, label, unit }) => [key, { label, unit: unit ?? "" }]),
  );
  for (const field of MATERIAL_SPEC_FIELDS)
    if (!labels.has(field.key))
      labels.set(field.key, { label: field.label, unit: field.unit });
  for (const [key, meta] of EXTRA_SPEC_LABELS)
    if (PUBLIC_PRODUCT_SPEC_KEYS.has(key) && !labels.has(key))
      labels.set(key, meta);
  for (const [key, meta] of PUBLIC_SPEC_LABELS)
    if (!labels.has(key)) labels.set(key, meta);
  for (const key of Object.keys(values)) {
    if (isPublicSpecificationKey(key) && !labels.has(key))
      labels.set(key, {
        label: key
          .replaceAll(/([A-Z])/g, " $1")
          .replaceAll("_", " ")
          .replace(/^./, (letter) => letter.toUpperCase()),
        unit: "",
      });
  }
  const keys = new Set([
    ...input.requiredSpecs.filter((key) => SPEC_LABELS.has(key)),
    ...template.filter((field) => values[field.key]).map((field) => field.key),
    ...Object.keys(values).filter(
      (key) => isPublicSpecificationKey(key) && labels.has(key),
    ),
  ]);
  return [...keys].flatMap((key) => {
    const meta = labels.get(key);
    if (!meta || !isPublicSpecificationKey(key)) return [];
    const value = values[key] ?? "";
    const isSelect = ["grade", "finish", "pvdColour"].includes(key);
    const customerInput = publicSpecificationAllowsCustomerInput(key, value);
    let options: string[] | undefined = undefined;
    if (isSelect && !customerInput) {
      if (value) {
        options = [value];
      }
    }
    return [
      {
        key,
        label: meta.label,
        type:
          isSelect && !customerInput
            ? ("select" as const)
            : NUMERIC_SPEC_KEYS.has(key)
              ? ("number" as const)
              : ("text" as const),
        required: input.requiredSpecs.includes(key),
        unit: meta.unit || undefined,
        value,
        customerInput,
        ...(customerInput ? { placeholder: value } : {}),
        ...(options ? { options } : {}),
      },
    ];
  });
}

/** Category-free public catalog used by the website. Category is always resolved from each material. */
export async function getPublicEnquiryProductList(query: string, page: number) {
  const { plant, categories } = await publicPlant();
  const publicCategoryIds = new Set(
    categories
      .filter((category) => {
        if (
          category.status.toLowerCase() !== "active" ||
          !PUBLIC_CATEGORY_TYPES.has(category.categoryType)
        )
          return false;
        let current: typeof category | undefined = category;
        const seen = new Set<string>();
        while (current && !seen.has(current.id)) {
          seen.add(current.id);
          if (["TRADING", "MFG"].includes(current.code.trim().toUpperCase()))
            return true;
          current = current.parentId
            ? categories.find((candidate) => candidate.id === current?.parentId)
            : undefined;
        }
        return false;
      })
      .map((category) => category.id),
  );
  if (!publicCategoryIds.size)
    return { products: [], page, pageSize: 50, hasMore: false };
  const categoryById = new Map(
    categories
      .filter((category) => publicCategoryIds.has(category.id))
      .map((category) => [category.id, category]),
  );
  const productRows = await prisma.product.findMany({
    where: {
      plantId: plant.id,
      isActive: true,
      categoryId: { in: [...publicCategoryIds] },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { sku: { contains: query, mode: "insensitive" as const } },
              {
                variants: {
                  some: {
                    sku: { contains: query, mode: "insensitive" as const },
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      sku: true,
      name: true,
      categoryId: true,
      productType: true,
      baseUnit: {
        select: { id: true, symbol: true, name: true, isActive: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sku: "asc" },
        select: {
          id: true,
          sku: true,
          displayName: true,
          grade: true,
          thicknessMm: true,
          widthMm: true,
          lengthMm: true,
          diameterMm: true,
          finish: true,
          attributes: true,
          unit: {
            select: { id: true, symbol: true, name: true, isActive: true },
          },
          materialMaster: {
            select: {
              id: true,
              shape: true,
              grade: true,
              thickness: true,
              width: true,
              length: true,
              diameter: true,
              weightPerPiece: true,
              specs: true,
              uom: true,
              salesUom: true,
              active: true,
              salesAllowed: true,
              isDemo: true,
            },
          },
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          categoryType: true,
          productForm: true,
          requiredSpecs: true,
          status: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { sku: "asc" }],
    skip: (page - 1) * 50,
    take: 51,
  });
  const products = productRows.slice(0, 50).flatMap((row) => {
    const category = row.categoryId ? categoryById.get(row.categoryId) : null;
    if (
      !category ||
      !row.category ||
      row.category.status.toLowerCase() !== "active"
    )
      return [];
    const variants = row.variants.filter(
      (variant) =>
        !variant.materialMaster ||
        (variant.materialMaster.active &&
          variant.materialMaster.salesAllowed &&
          !variant.materialMaster.isDemo),
    );
    if (!variants.length) return [];
    let rootCategory = category;
    let currentCat: typeof category | undefined = category;
    const seenCats = new Set<string>();
    while (currentCat && !seenCats.has(currentCat.id)) {
      seenCats.add(currentCat.id);
      const codeUpper = currentCat.code.trim().toUpperCase();
      if (codeUpper === "TRADING" || codeUpper === "MFG") {
        rootCategory = currentCat;
        break;
      }
      currentCat = currentCat.parentId
        ? categories.find((c) => c.id === currentCat?.parentId)
        : undefined;
    }

    return variants.flatMap((variant) => {
      const material =
        variant.materialMaster?.active &&
        variant.materialMaster.salesAllowed &&
        !variant.materialMaster.isDemo
          ? variant.materialMaster
          : null;
      const unit = variant?.unit?.isActive
        ? variant.unit
        : row.baseUnit?.isActive
          ? row.baseUnit
          : null;
      if (!unit) return [];
      const specifications = productSpecifications({
        productForm: category.productForm,
        shape: material?.shape ?? null,
        categoryType: category.categoryType,
        productType: row.productType,
        requiredSpecs: category.requiredSpecs,
        grade: material?.grade ?? variant?.grade ?? null,
        thickness: material?.thickness ?? variant?.thicknessMm ?? null,
        width: material?.width ?? variant?.widthMm ?? null,
        length: material?.length ?? variant?.lengthMm ?? null,
        diameter: material?.diameter ?? variant?.diameterMm ?? null,
        weightPerPiece: material?.weightPerPiece ?? null,
        variant,
        specs: normalizePublicProductSpecs(
          variant.sku,
          material?.specs ?? variant.attributes,
        ),
      });
      return [
        {
          id: row.id,
          name: row.name,
          code: variant?.sku ?? row.sku,
          category: { id: rootCategory.id, name: rootCategory.name },
          productVariantId: variant?.id ?? null,
          displayName: variant?.displayName ?? null,
          uom: { id: unit.id, code: unit.symbol, name: unit.name },
          uomOptions: [
            {
              id: unit.id,
              code: unit.symbol,
              name: unit.name,
              isDefault: true,
            },
          ],
          specifications,
        },
      ];
    });
  });
  return { products, page, pageSize: 50, hasMore: productRows.length > 50 };
}

export function publicCategoryIdIsValid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
