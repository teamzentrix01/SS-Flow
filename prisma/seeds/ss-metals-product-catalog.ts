import { Prisma, type Product, type ProductVariant } from "@prisma/client";
import { prisma } from "../../src/db";
import { BUSINESS_ROOTS } from "../../src/lib/domain/business-categories";
import { uuidv7 } from "../../src/lib/ids";

const SEED_VERSION = "ssm-catalog-v4";
const REFERENCE_DATE = "2026-10-27";

const SOURCES = {
  jindal: "https://www.iberjindal.com/products-grades/",
  sail: "https://sail.co.in/en/products/sail-stainless-products",
  stainlessIndia: "https://www.stainlessindia.net/ss-sheets-plates.html",
  vandana: "https://www.vandanaglobal.com/data/ss-billets%26ss-wire-rod.pdf",
  jnbCircle: "https://www.jnbsteel.com/stainless-steel-circle/",
  serenityCircle:
    "https://serenitygroup.co.in/product/stainless-steel-circles/",
} as const;

type Family = {
  code: string;
  name: string;
  kind: "trading" | "manufactured";
  unit: "KG" | "PCS";
  shape: string;
  variants: {
    code: string;
    grade?: string;
    finish?: string;
    thickness?: string;
    width?: string;
    length?: string;
    diameter?: string;
    unit?: "KG" | "PCS";
    attributes: Record<string, string | number | boolean | null>;
    sources: string[];
    provenance: "published_reference" | "representative_assumption";
  }[];
};

const FAMILIES: Family[] = [
  {
    code: "SSM-TRD-COIL",
    name: "Coil",
    kind: "trading",
    unit: "KG",
    shape: "coil",
    variants: [
      {
        code: "304-2B-050-1000",
        grade: "304",
        finish: "2B",
        thickness: "0.50",
        width: "1000",
        attributes: {
          sizeNote: "Representative stock-program size",
        },
        sources: [SOURCES.sail, SOURCES.stainlessIndia],
        provenance: "published_reference",
      },
      {
        code: "304-2B-080-1250",
        grade: "304",
        finish: "2B",
        thickness: "0.80",
        width: "1250",
        attributes: {
          sizeNote: "Representative stock-program size",
        },
        sources: [SOURCES.jindal, SOURCES.stainlessIndia],
        provenance: "published_reference",
      },
      {
        code: "316-2B-100-1250",
        grade: "316",
        finish: "2B",
        thickness: "1.00",
        width: "1250",
        attributes: {
          sizeNote: "Representative stock-program size",
        },
        sources: [SOURCES.jindal, SOURCES.sail],
        provenance: "published_reference",
      },
    ],
  },
  {
    code: "SSM-TRD-SHEET",
    name: "Sheet",
    kind: "trading",
    unit: "KG",
    shape: "sheet",
    variants: [
      {
        code: "304-2B-050-1000-2000",
        grade: "304",
        finish: "2B",
        thickness: "0.50",
        width: "1000",
        length: "2000",
        attributes: {},
        sources: [SOURCES.jindal, SOURCES.sail],
        provenance: "published_reference",
      },
      {
        code: "304-2B-080-1250-2500",
        grade: "304",
        finish: "2B",
        thickness: "0.80",
        width: "1250",
        length: "2500",
        attributes: {},
        sources: [SOURCES.jindal],
        provenance: "published_reference",
      },
      {
        code: "316-MIRROR-100-1250-2500",
        grade: "316",
        finish: "Mirror / No. 8",
        thickness: "1.00",
        width: "1250",
        length: "2500",
        attributes: { decorativeSubtype: "Mirror" },
        sources: [SOURCES.jindal, SOURCES.stainlessIndia],
        provenance: "published_reference",
      },
      {
        code: "304-MIRROR-080-1000-2000",
        grade: "304",
        finish: "Mirror / No. 8",
        thickness: "0.80",
        width: "1000",
        length: "2000",
        attributes: { decorativeSubtype: "Mirror" },
        sources: [SOURCES.jindal, SOURCES.stainlessIndia],
        provenance: "published_reference",
      },
      {
        code: "304-MATT-080-1000-2000",
        grade: "304",
        finish: "Matt",
        thickness: "0.80",
        width: "1000",
        length: "2000",
        attributes: { decorativeSubtype: "Matt" },
        sources: [SOURCES.stainlessIndia],
        provenance: "published_reference",
      },
      {
        code: "304-PVD-080-1000-2000",
        grade: "304",
        finish: "PVD",
        thickness: "0.80",
        width: "1000",
        length: "2000",
        attributes: { decorativeSubtype: "PVD" },
        sources: [SOURCES.stainlessIndia],
        provenance: "representative_assumption",
      },
    ],
  },
  {
    code: "SSM-TRD-ROD",
    name: "Rod",
    kind: "trading",
    unit: "KG",
    shape: "round_wire_rod",
    variants: [
      {
        code: "304-ROD-055",
        grade: "304",
        diameter: "5.50",
        attributes: {},
        sources: [SOURCES.vandana],
        provenance: "published_reference",
      },
      {
        code: "304-ROD-080",
        grade: "304",
        diameter: "8.00",
        attributes: {},
        sources: [SOURCES.vandana],
        provenance: "published_reference",
      },
    ],
  },
  {
    code: "SSM-TRD-WIRE",
    name: "Wire",
    kind: "trading",
    unit: "KG",
    shape: "wire",
    variants: [
      {
        code: "304-WIRE-COIL",
        grade: "304",
        attributes: {
          productForm: "coil",
          finishOrCondition: "bright / annealed",
        },
        sources: [SOURCES.vandana],
        provenance: "representative_assumption",
      },
      {
        code: "304-WIRE-CUT",
        grade: "304",
        unit: "PCS",
        attributes: {
          productForm: "cut wire piece",
          finishOrCondition: "bright / annealed",
        },
        sources: [SOURCES.vandana],
        provenance: "representative_assumption",
      },
      {
        code: "316-WIRE-COIL",
        grade: "316",
        attributes: {
          productForm: "coil",
          finishOrCondition: "bright / annealed",
        },
        sources: [SOURCES.vandana],
        provenance: "representative_assumption",
      },
    ],
  },
  {
    code: "SSM-MFG-LASER-FARMA",
    name: "Laser Cut Farma",
    kind: "manufactured",
    unit: "PCS",
    shape: "laser_cut_component",
    variants: [
      {
        code: "304-LASER-CUSTOM-DRAWING",
        grade: "304",
        thickness: "0.80",
        attributes: {
          designReference: "customer drawing required",
          cutProfile: "customer specified; no standard pattern assumed",
          dimensions: "per approved drawing",
          finish: "confirm per order",
        },
        sources: [SOURCES.stainlessIndia],
        provenance: "representative_assumption",
      },
    ],
  },
  {
    code: "SSM-MFG-CIRCLE",
    name: "Circle",
    kind: "manufactured",
    unit: "PCS",
    shape: "circle_blank",
    variants: [
      {
        code: "201-2B-050-200",
        grade: "201",
        finish: "2B",
        thickness: "0.50",
        diameter: "200",
        attributes: { edgeType: "slit" },
        sources: [SOURCES.serenityCircle],
        provenance: "published_reference",
      },
      {
        code: "304-BA-080-300",
        grade: "304",
        finish: "BA",
        thickness: "0.80",
        diameter: "300",
        attributes: { edgeType: "slit" },
        sources: [SOURCES.jnbCircle, SOURCES.serenityCircle],
        provenance: "published_reference",
      },
      {
        code: "430-2B-100-400",
        grade: "430",
        finish: "2B",
        thickness: "1.00",
        diameter: "400",
        attributes: { edgeType: "slit" },
        sources: [SOURCES.serenityCircle],
        provenance: "published_reference",
      },
    ],
  },
  {
    code: "SSM-MFG-SEMI-FINISH-UTENSILS",
    name: "Semi Finish Utensils",
    kind: "manufactured",
    unit: "PCS",
    shape: "semi_finished_utensil",
    variants: [
      {
        code: "CONFIG",
        attributes: {
          utensilType: "Utensil",
          stageOfManufacture: "semi-finished; define per process",
          dimensions: "configure by design",
          capacityLitres: "optional; configure when relevant",
          materialGrade: "configure per order",
          thickness: "configure per order",
          finish: "configure per order",
        },
        sources: [],
        provenance: "representative_assumption" as const,
      },
    ],
  },
  {
    code: "SSM-MFG-FARMA",
    name: "Farma",
    kind: "manufactured",
    unit: "PCS",
    shape: "utensil_farma_component",
    variants: [
      {
        code: "304-2B-080",
        grade: "304",
        finish: "2B",
        thickness: "0.80",
        attributes: {
          productionRemarks: "confirm with production",
        },
        sources: [],
        provenance: "representative_assumption",
      },
      {
        code: "304-BA-080",
        grade: "304",
        finish: "BA",
        thickness: "0.80",
        attributes: {
          productionRemarks: "as drawn / confirm with production",
        },
        sources: [],
        provenance: "representative_assumption",
      },
    ],
  },
];

const RETIRED_GROUPED_PRODUCTS = [
  {
    code: "SSM-MFG-SEMI-FINISH-ICE-BUCKET",
    replacements: ["SSM-MFG-SEMI-FINISH-UTENSILS"],
  },
  {
    code: "SSM-MFG-SEMI-FINISH-CANISTER",
    replacements: ["SSM-MFG-SEMI-FINISH-UTENSILS"],
  },
  {
    code: "SSM-MFG-SEMI-FINISH-JUG",
    replacements: ["SSM-MFG-SEMI-FINISH-UTENSILS"],
  },
  {
    code: "FARMA-1",
    replacements: ["SSM-MFG-FARMA"],
  },
  {
    code: "SSM-MFG-FARMA-UTENSILS",
    replacements: ["SSM-MFG-FARMA"],
  },
  {
    code: "SSM-TRD-WIRE-PCS",
    replacements: ["SSM-TRD-WIRE"],
  },
  {
    code: "SSM-TRD-MIRROR-MATT-PVD",
    replacements: ["SSM-TRD-SHEET"],
  },
  {
    code: "SSM-MFG-JUG-FARMA",
    replacements: ["SSM-MFG-FARMA"],
  },
  {
    code: "SSM-MFG-BHOJANTHAAL-FARMA",
    replacements: ["SSM-MFG-FARMA"],
  },
  {
    code: "SSM-MFG-CUSTOM-UTENSIL-FARMA",
    replacements: ["SSM-MFG-FARMA"],
  },
] as const;

type Counts = {
  inserted: number;
  reused: number;
  updated: number;
  skipped: number;
  failed: number;
};
const emptyCounts = (): Counts => ({
  inserted: 0,
  reused: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
});
const normalized = (value: string) => value.trim().toLocaleLowerCase("en-US");
const jsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const hasSeedMetadata = (value: Prisma.JsonValue | null | undefined) =>
  "seedMetadata" in jsonObject(value);
const slug = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function seedMetadata(family: Family, spec: Family["variants"][number]) {
  return {
    seedMetadata: {
      seedId: `${family.code}:${spec.code}`,
      seedVersion: SEED_VERSION,
      referenceDate: REFERENCE_DATE,
      provenance: spec.provenance,
      sourceUrls: spec.sources,
      managedValues: {
        grade: spec.grade ?? null,
        finish: spec.finish ?? null,
        thickness: spec.thickness ?? null,
        width: spec.width ?? null,
        length: spec.length ?? null,
        diameter: spec.diameter ?? null,
        attributes: spec.attributes,
      },
      note:
        spec.provenance === "published_reference"
          ? "Representative values within a published product range; confirm exact grade/finish/size availability with the supplier before quotation."
          : "Configurable starter record, not a supplier availability claim or standard dimension. Confirm details before quotation or production.",
    },
  } satisfies Prisma.InputJsonObject;
}

function sameSeedValue(actual: unknown, expected: unknown) {
  if (actual == null || expected == null)
    return actual == null && expected == null;
  if (
    (typeof actual === "string" || typeof actual === "number") &&
    (typeof expected === "string" || typeof expected === "number")
  ) {
    const actualNumber = Number(actual);
    const expectedNumber = Number(expected);
    if (Number.isFinite(actualNumber) && Number.isFinite(expectedNumber))
      return actualNumber === expectedNumber;
  }
  return String(actual).trim() === String(expected).trim();
}

function hasUserEditedManagedVariant(
  variant: ProductVariant,
  spec: Family["variants"][number],
) {
  const root = jsonObject(jsonObject(variant.attributes).seedMetadata);
  const stored = jsonObject(root.managedValues);
  const expected = Object.keys(stored).length
    ? stored
    : {
        grade: spec.grade ?? null,
        finish: spec.finish ?? null,
        thickness: spec.thickness ?? null,
        width: spec.width ?? null,
        length: spec.length ?? null,
        diameter: spec.diameter ?? null,
        attributes: spec.attributes,
      };
  const actualFields = {
    grade: variant.grade,
    finish: variant.finish,
    thickness: variant.thicknessMm?.toString() ?? null,
    width: variant.widthMm?.toString() ?? null,
    length: variant.lengthMm?.toString() ?? null,
    diameter: variant.diameterMm?.toString() ?? null,
  };
  for (const key of [
    "grade",
    "finish",
    "thickness",
    "width",
    "length",
    "diameter",
  ]) {
    if (
      !sameSeedValue(
        actualFields[key as keyof typeof actualFields],
        expected[key],
      )
    )
      return true;
  }
  const expectedAttrs = jsonObject(
    expected.attributes as Prisma.JsonValue | undefined,
  );
  const actualAttrs = jsonObject(variant.attributes);
  for (const [key, value] of Object.entries(expectedAttrs)) {
    if (!sameSeedValue(actualAttrs[key], value)) return true;
  }
  return false;
}

async function ensureColumnSupport() {
  const schemaName = process.env.DATABASE_URL
    ? (new URL(process.env.DATABASE_URL).searchParams.get("schema") ?? "public")
    : "public";
  const result = await prisma.$queryRaw<
    Array<{ table_name: string; column_name: string }>
  >`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = ${schemaName}
      AND ((table_name = 'product_variants' AND column_name IN ('display_name', 'attributes', 'material_master_id'))
        OR (table_name = 'products' AND column_name IN ('sku', 'category_id', 'base_unit_id')))
  `;
  const found = new Set(
    result.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const required = [
    "product_variants.display_name",
    "product_variants.attributes",
    "product_variants.material_master_id",
    "products.sku",
    "products.category_id",
    "products.base_unit_id",
  ];
  const missing = required.filter((column) => !found.has(column));
  if (missing.length)
    throw new Error(
      `Database schema is missing ${missing.join(", ")}. Apply the repository migrations before running this seed.`,
    );
}

async function ensureUnit(
  tx: Prisma.TransactionClient,
  plantId: string,
  symbol: Family["unit"],
) {
  const details =
    symbol === "KG"
      ? { name: "Kilogram", unitType: "weight" }
      : { name: "Piece", unitType: "count" };
  const existing = await tx.unitOfMeasure.findUnique({
    where: { plantId_symbol: { plantId, symbol } },
  });
  if (existing) return existing;
  return tx.unitOfMeasure.create({
    data: { id: uuidv7(), plantId, symbol, ...details },
  });
}

async function resolveRoot(
  tx: Prisma.TransactionClient,
  plantId: string,
  kind: Family["kind"],
) {
  const definition = BUSINESS_ROOTS[kind];
  const found = await tx.productCategory.findFirst({
    where: { plantId, code: definition.code },
  });
  if (found) return found;
  return tx.productCategory.create({
    data: {
      id: uuidv7(),
      plantId,
      code: definition.code,
      name: definition.name,
      subtitle: definition.subtitle,
      description: definition.description,
      categoryType: definition.categoryType,
      status: "active",
    },
  });
}

function variantSku(family: Family, spec: Family["variants"][number]) {
  return `${family.code}-V-${slug(spec.code)}`;
}

async function seedFamily(
  plantId: string,
  family: Family,
  counts: { products: Counts; variants: Counts; materials: Counts },
) {
  const local = {
    products: emptyCounts(),
    variants: emptyCounts(),
    materials: emptyCounts(),
  };
  await prisma.$transaction(
    async (tx) => {
      const root = await resolveRoot(tx, plantId, family.kind);
      const familyUnit = await ensureUnit(tx, plantId, family.unit);
      const bySku = await tx.product.findUnique({
        where: { plantId_sku: { plantId, sku: family.code } },
      });
      const existingSeedVariant = await tx.productVariant.findFirst({
        where: { plantId, sku: { startsWith: `${family.code}-V-` } },
        select: { productId: true },
      });
      const seedVariantOwner = existingSeedVariant
        ? await tx.product.findUnique({
            where: { id: existingSeedVariant.productId },
          })
        : null;
      const byName =
        bySku || seedVariantOwner
          ? null
          : ((
              await tx.product.findMany({
                where: {
                  plantId,
                  name: { equals: family.name, mode: "insensitive" },
                },
                include: { _count: { select: { variants: true } } },
                orderBy: { createdAt: "asc" },
              })
            ).sort((a, b) => b._count.variants - a._count.variants)[0] ?? null);
      let product: Product;
      if (bySku && normalized(bySku.name) !== normalized(family.name)) {
        throw new Error(
          `${plantId}: product code ${family.code} is already used by "${bySku.name}".`,
        );
      }
      if (
        seedVariantOwner &&
        normalized(seedVariantOwner.name) !== normalized(family.name)
      ) {
        throw new Error(
          `${plantId}: seeded variant code ${family.code} is attached to a different parent "${seedVariantOwner.name}".`,
        );
      }
      const existing = seedVariantOwner ?? bySku ?? byName;
      if (existing) {
        const activeExpectedVariantCount = await tx.productVariant.count({
          where: {
            productId: existing.id,
            plantId,
            isActive: true,
            sku: {
              in: family.variants.map((spec) => variantSku(family, spec)),
            },
          },
        });
        const restoreCatalogParent =
          !existing.isActive &&
          activeExpectedVariantCount === family.variants.length;
        product = await tx.product.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            ...(existing.categoryId !== root.id ? { categoryId: root.id } : {}),
            ...(!existing.baseUnitId ? { baseUnitId: familyUnit.id } : {}),
          },
        });
        if (
          existing.categoryId === root.id &&
          existing.baseUnitId &&
          !restoreCatalogParent
        )
          local.products.reused++;
        else local.products.updated++;
      } else {
        product = await tx.product.create({
          data: {
            id: uuidv7(),
            plantId,
            sku: family.code,
            name: family.name,
            categoryId: root.id,
            productType:
              family.kind === "trading" ? "raw_material" : "finished",
            supplyMode:
              family.kind === "trading" ? "purchased" : "manufactured",
            baseUnitId: familyUnit.id,
            trackInventory: false,
          },
        });
        local.products.inserted++;
      }

      for (const spec of family.variants) {
        const sku = variantSku(family, spec);
        const unit = spec.unit
          ? await ensureUnit(tx, plantId, spec.unit)
          : familyUnit;
        const current = await tx.productVariant.findUnique({
          where: { plantId_sku: { plantId, sku } },
        });
        const candidates = current
          ? []
          : await tx.productVariant.findMany({
              where: {
                plantId,
                productId: product.id,
                grade: spec.grade ?? null,
                finish: spec.finish ?? null,
                thicknessMm: spec.thickness ?? null,
                widthMm: spec.width ?? null,
                lengthMm: spec.length ?? null,
                diameterMm: spec.diameter ?? null,
              },
            });
        const naturalMatch =
          current ??
          candidates.find((candidate) =>
            Object.entries(spec.attributes).every(([key, value]) =>
              sameSeedValue(jsonObject(candidate.attributes)[key], value),
            ),
          ) ??
          null;
        if (naturalMatch && naturalMatch.productId !== product.id) {
          local.variants.skipped++;
          console.warn(
            `  SKIP ${sku}: matching code is already attached to a different parent product.`,
          );
          continue;
        }
        if (naturalMatch && !hasSeedMetadata(naturalMatch.attributes)) {
          local.variants.skipped++;
          console.warn(
            `  SKIP ${sku}: matching specification exists and is not seed-managed; preserved without changes.`,
          );
          continue;
        }
        const oldSeed = naturalMatch
          ? jsonObject(jsonObject(naturalMatch.attributes).seedMetadata)
          : {};
        const recoverMisassignedSeedRecord =
          naturalMatch &&
          oldSeed.seedVersion === SEED_VERSION &&
          typeof oldSeed.seedId === "string" &&
          oldSeed.seedId.startsWith(`${family.code}:`) &&
          oldSeed.seedId !== `${family.code}:${spec.code}`;
        if (
          naturalMatch &&
          !recoverMisassignedSeedRecord &&
          hasUserEditedManagedVariant(naturalMatch, spec)
        ) {
          local.variants.skipped++;
          console.warn(
            `  SKIP ${sku}: seed-managed fields were edited after seeding; preserved.`,
          );
          continue;
        }
        if (naturalMatch && !recoverMisassignedSeedRecord) {
          const metadata = jsonObject(
            jsonObject(naturalMatch.attributes).seedMetadata,
          );
          if (metadata.seedVersion === SEED_VERSION) {
            local.variants.reused++;
            if (naturalMatch.materialMasterId) local.materials.reused++;
            continue;
          }
        }

        const priorAttrs = naturalMatch
          ? jsonObject(naturalMatch.attributes)
          : {};
        const customAttrs = Object.fromEntries(
          Object.entries(priorAttrs).filter(
            ([key]) => key !== "seedMetadata" && !(key in spec.attributes),
          ),
        );
        const attrs = {
          ...customAttrs,
          ...spec.attributes,
          ...seedMetadata(family, spec),
        } as Prisma.InputJsonObject;
        const data = {
          displayName: `${family.name} · ${spec.code.replaceAll("-", " ")}`,
          grade: spec.grade ?? null,
          finish: spec.finish ?? null,
          thicknessMm: spec.thickness ?? null,
          widthMm: spec.width ?? null,
          lengthMm: spec.length ?? null,
          diameterMm: spec.diameter ?? null,
          attributes: attrs,
          unitId: unit.id,
          isActive: true,
        };
        let variant: ProductVariant;
        if (naturalMatch) {
          variant = await tx.productVariant.update({
            where: { id: naturalMatch.id },
            data,
          });
          local.variants.updated++;
        } else {
          variant = await tx.productVariant.create({
            data: {
              id: uuidv7(),
              plantId,
              productId: product.id,
              sku,
              ...data,
            },
          });
          local.variants.inserted++;
        }

        let material = variant.materialMasterId
          ? await tx.materialMaster.findUnique({
              where: { id: variant.materialMasterId },
            })
          : await tx.materialMaster.findUnique({
              where: { plantId_code: { plantId, code: variant.sku } },
            });
        if (!material) {
          material = await tx.materialMaster.create({
            data: {
              id: uuidv7(),
              plantId,
              code: variant.sku,
              name: data.displayName,
              category: family.kind === "trading" ? "raw" : "finished",
              categoryId: root.id,
              productType:
                family.kind === "trading" ? "raw_material" : "finished",
              shape: family.shape,
              uom: family.unit,
              purchaseUom: family.unit,
              salesUom: family.unit,
              grade: data.grade,
              thickness: data.thicknessMm,
              width: data.widthMm,
              length: data.lengthMm,
              diameter: data.diameterMm,
              purchaseAllowed: family.kind === "trading",
              salesAllowed: true,
              manufacturingAllowed: family.kind === "manufactured",
              specs: attrs,
              active: true,
              isDemo: false,
            },
          });
          local.materials.inserted++;
        } else if (
          variant.materialMasterId === material.id &&
          naturalMatch &&
          hasSeedMetadata(naturalMatch.attributes) &&
          !hasUserEditedManagedVariant(naturalMatch, spec)
        ) {
          await tx.materialMaster.update({
            where: { id: material.id },
            data: {
              name: data.displayName,
              categoryId: root.id,
              productType:
                family.kind === "trading" ? "raw_material" : "finished",
              shape: family.shape,
              uom: family.unit,
              salesUom: family.unit,
              grade: data.grade,
              thickness: data.thicknessMm,
              width: data.widthMm,
              length: data.lengthMm,
              diameter: data.diameterMm,
              specs: attrs,
              active: true,
            },
          });
          local.materials.updated++;
        } else {
          local.materials.reused++;
        }
        if (!variant.materialMasterId) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { materialMasterId: material.id },
          });
        }
      }
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
  for (const key of ["products", "variants", "materials"] as const) {
    for (const metric of [
      "inserted",
      "updated",
      "reused",
      "skipped",
      "failed",
    ] as const) {
      counts[key][metric] += local[key][metric];
    }
  }
}

async function retireGroupedSeedProducts(plantId: string) {
  await prisma.$transaction(
    async (tx) => {
      for (const retired of RETIRED_GROUPED_PRODUCTS) {
        const replacementCount = await tx.product.count({
          where: {
            plantId,
            sku: { in: [...retired.replacements] },
            isActive: true,
          variants: { some: { isActive: true } },
          },
        });
        if (replacementCount !== retired.replacements.length) continue;

        const product = await tx.product.findUnique({
          where: { plantId_sku: { plantId, sku: retired.code } },
          include: {
            variants: {
              select: {
                id: true,
                attributes: true,
                materialMasterId: true,
                isActive: true,
              },
            },
          },
        });
        if (!product) continue;

        const managedVariants = product.variants.filter((variant) =>
          hasSeedMetadata(variant.attributes),
        );
        const managedVariantIds = managedVariants
          .filter((variant) => variant.isActive)
          .map((variant) => variant.id);
        const materialIds = managedVariants.flatMap((variant) =>
          variant.materialMasterId ? [variant.materialMasterId] : [],
        );
        if (managedVariantIds.length) {
          await tx.productVariant.updateMany({
            where: { id: { in: managedVariantIds } },
            data: { isActive: false },
          });
        }
        if (materialIds.length) {
          await tx.materialMaster.updateMany({
            where: { id: { in: materialIds } },
            data: { active: false, salesAllowed: false },
          });
        }
        const activeVariantCount = await tx.productVariant.count({
          where: { productId: product.id, isActive: true },
        });
        if (!activeVariantCount && product.isActive) {
          await tx.product.update({
            where: { id: product.id },
            data: { isActive: false },
          });
        }
      }
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
}

async function main() {
  await ensureColumnSupport();
  const plants = await prisma.plant.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });
  if (!plants.length)
    throw new Error(
      "No plants exist in this database. Run the repository's normal database seed first.",
    );
  const summary = {
    products: emptyCounts(),
    variants: emptyCounts(),
    materials: emptyCounts(),
    plants: plants.length,
    families: FAMILIES.length,
  };
  const errors: string[] = [];
  for (const plant of plants) {
    console.log(`Seeding SS-Metals catalog for ${plant.code}...`);
    for (const family of FAMILIES) {
      try {
        await seedFamily(plant.id, family, summary);
      } catch (error) {
        summary.products.failed++;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.error(`  FAILED ${family.code}: ${message}`);
      }
    }
    try {
      await retireGroupedSeedProducts(plant.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(
        `${plant.code}: could not retire grouped utensil products: ${message}`,
      );
    }
    const expectedVariants = FAMILIES.flatMap((family) =>
      family.variants.map((spec) => ({
        family,
        sku: variantSku(family, spec),
      })),
    );
    const verification = await prisma.productVariant.findMany({
      where: {
        plantId: plant.id,
        sku: { in: expectedVariants.map(({ sku }) => sku) },
        isActive: true,
      },
      include: {
        product: {
          select: { isActive: true, category: { select: { code: true } } },
        },
        materialMaster: {
          select: { active: true, salesAllowed: true, isDemo: true },
        },
      },
    });
    for (const family of FAMILIES) {
      const expected = expectedVariants.filter(
        (row) => row.family.code === family.code,
      );
      const available = verification.filter(
        (variant) =>
          expected.some((row) => row.sku === variant.sku) &&
          variant.product.isActive &&
          variant.product.category?.code === BUSINESS_ROOTS[family.kind].code &&
          variant.materialMaster?.active &&
          variant.materialMaster.salesAllowed &&
          !variant.materialMaster.isDemo,
      );
      const missing = expected.filter(
        (row) => !available.some((variant) => variant.sku === row.sku),
      );
      if (missing.length) {
        errors.push(
          `${plant.code}: ${family.name} is missing ${missing.map((row) => row.sku).join(", ")} or has an invalid category/active catalog link.`,
        );
      }
    }
  }
  console.log("\nSS-Metals catalog seed summary");
  console.log(
    `Plants: ${summary.plants}; parent product families: ${summary.families}`,
  );
  for (const key of ["products", "variants", "materials"] as const) {
    const c = summary[key];
    console.log(
      `${key}: inserted ${c.inserted}, updated ${c.updated}, reused ${c.reused}, skipped ${c.skipped}, failed ${c.failed}`,
    );
  }
  console.log(`Errors: ${errors.length}`);
  if (errors.length) {
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      "SS-Metals catalog seed failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
