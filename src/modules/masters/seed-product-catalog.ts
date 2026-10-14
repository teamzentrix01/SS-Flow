import { prisma } from "@/db";
import { uuidv7 } from "@/lib/ids";

type UnitSeed = { symbol: string; name: string; unitType: string };

const DEFAULT_UNITS: UnitSeed[] = [
  { symbol: "KG", name: "Kilogram", unitType: "weight" },
  { symbol: "T", name: "Tonne", unitType: "weight" },
  { symbol: "PCS", name: "Piece", unitType: "count" },
  { symbol: "M", name: "Meter", unitType: "length" },
];

/** SS-Metals starter categories and product families (not separate tables per SKU). */
const CATALOG: {
  category: { code: string; name: string; categoryType: string; productForm?: string };
  products: { sku: string; name: string; productType: string; supplyMode: string; unitSymbol: string }[];
}[] = [
  {
    category: { code: "STEEL-STOCK", name: "Steel Stock", categoryType: "raw_material" },
    products: [
      { sku: "COIL", name: "Coil", productType: "raw_material", supplyMode: "purchased", unitSymbol: "KG" },
      { sku: "SHEET", name: "Sheet", productType: "raw_material", supplyMode: "purchased", unitSymbol: "KG" },
      { sku: "WIRE", name: "Wire", productType: "raw_material", supplyMode: "purchased", unitSymbol: "KG" },
      { sku: "ROD", name: "Rod", productType: "raw_material", supplyMode: "purchased", unitSymbol: "KG" },
      { sku: "PIPE", name: "Pipe", productType: "raw_material", supplyMode: "purchased", unitSymbol: "KG" },
    ],
  },
  {
    category: { code: "SEMI-FG", name: "Semi-Finished", categoryType: "wip" },
    products: [
      { sku: "CIRCLE", name: "Circle", productType: "semi_finished", supplyMode: "both", unitSymbol: "PCS" },
      { sku: "BLANK", name: "Blank", productType: "semi_finished", supplyMode: "both", unitSymbol: "PCS" },
      { sku: "FARMA", name: "Farma Design", productType: "semi_finished", supplyMode: "both", unitSymbol: "PCS" },
    ],
  },
  {
    category: { code: "FG-UTENSILS", name: "Finished Goods", categoryType: "finished_goods", productForm: "utensil" },
    products: [{ sku: "UTENSILS", name: "Utensils", productType: "finished", supplyMode: "manufactured", unitSymbol: "PCS" }],
  },
];

export async function seedUnits(plantId: string) {
  const ids = new Map<string, string>();
  for (const unit of DEFAULT_UNITS) {
    const row = await prisma.unitOfMeasure.upsert({
      where: { plantId_symbol: { plantId, symbol: unit.symbol } },
      update: { name: unit.name, unitType: unit.unitType, isActive: true },
      create: { id: uuidv7(), plantId, name: unit.name, symbol: unit.symbol, unitType: unit.unitType },
    });
    ids.set(unit.symbol, row.id);
  }
  return ids;
}

export async function seedProductCatalog(plantId: string) {
  const unitIds = await seedUnits(plantId);
  for (const block of CATALOG) {
    const category = await prisma.productCategory.upsert({
      where: { plantId_code: { plantId, code: block.category.code } },
      update: { name: block.category.name, categoryType: block.category.categoryType, status: "active" },
      create: {
        id: uuidv7(),
        plantId,
        code: block.category.code,
        name: block.category.name,
        categoryType: block.category.categoryType,
        productForm: block.category.productForm ?? null,
        status: "active",
      },
    });
    for (const p of block.products) {
      const baseUnitId = unitIds.get(p.unitSymbol)!;
      await prisma.product.upsert({
        where: { plantId_sku: { plantId, sku: p.sku } },
        update: {
          name: p.name,
          categoryId: category.id,
          productType: p.productType,
          supplyMode: p.supplyMode,
          baseUnitId,
          isActive: true,
        },
        create: {
          id: uuidv7(),
          plantId,
          sku: p.sku,
          name: p.name,
          categoryId: category.id,
          productType: p.productType,
          supplyMode: p.supplyMode,
          baseUnitId,
          trackInventory: true,
        },
      });
    }
  }
}

/** Link existing material masters to catalog products/variants by code prefix. */
export async function linkLegacyMaterialsToCatalog(plantId: string) {
  const materials = await prisma.materialMaster.findMany({ where: { plantId }, include: { productVariant: true } });
  for (const material of materials) {
    if (material.productVariant) continue;
    const code = material.code.toUpperCase();
    let productSku: string | null = null;
    if (code.includes("SPOON") || code.includes("UTENSIL") || material.productType === "finished") productSku = "UTENSILS";
    else if (code.includes("SHEET")) productSku = "SHEET";
    else if (code.includes("COIL")) productSku = "COIL";
    else if (code.includes("SLIT") || code.includes("BLANK")) productSku = "BLANK";
    if (!productSku) continue;
    const product = await prisma.product.findFirst({ where: { plantId, sku: productSku } });
    if (!product) continue;
    const unit = await prisma.unitOfMeasure.findFirst({ where: { plantId, symbol: material.uom } });
    await prisma.productVariant.upsert({
      where: { plantId_sku: { plantId, sku: material.code } },
      update: { materialMasterId: material.id, productId: product.id },
      create: {
        id: uuidv7(),
        plantId,
        productId: product.id,
        sku: material.code,
        grade: material.grade,
        thicknessMm: material.thickness,
        widthMm: material.width,
        lengthMm: material.length,
        diameterMm: material.diameter,
        materialMasterId: material.id,
        unitId: unit?.id ?? product.baseUnitId,
      },
    });
  }
}
