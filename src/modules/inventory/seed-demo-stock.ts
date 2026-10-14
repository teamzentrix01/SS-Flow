import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { toMilli } from "@/lib/domain/qty";
import { uuidv7 } from "@/lib/ids";
import { postMovement } from "@/lib/inventory/post";

const TARGET_AVAILABLE_KG = "50000";
const MIN_AVAILABLE_KG = "10000";

/** Neon/serverless Postgres closes long interactive transactions (Prisma P2028). */
const TX_OPTS = { maxWait: 15_000, timeout: 30_000 } as const;

type Tx = Prisma.TransactionClient;

async function ensureDefaultLocation(tx: Tx, plantId: string) {
  const existing = await tx.storageLocation.findFirst({
    where: { warehouse: { plantId } },
    orderBy: { code: "asc" },
  });
  if (existing) return existing;

  const warehouse = await tx.warehouse.create({
    data: {
      id: uuidv7(),
      plantId,
      code: "WH-01",
      name: "Main bay",
    },
  });
  return tx.storageLocation.create({
    data: {
      id: uuidv7(),
      warehouseId: warehouse.id,
      code: "A-01",
      name: "Default rack",
    },
  });
}

function isRawMaterial(material: {
  category: string;
  productType: string | null;
}) {
  if (material.category === "raw" || material.category === "consumable") return true;
  if (material.productType === "raw_material" || material.productType === "consumable") return true;
  return false;
}

async function availablePassQty(tx: Tx, plantId: string, materialId: string) {
  const rows = await tx.stockBalance.findMany({
    where: {
      plantId,
      availableQty: { gt: 0 },
      batch: { materialId, qualityStatus: "pass" },
    },
  });
  return rows.reduce((sum, row) => sum + toMilli(row.availableQty.toString()), 0n);
}

async function seedMaterialLine(
  tx: Tx,
  input: {
    plantId: string;
    materialId: string;
    materialCode: string;
    uom: string;
    locationId: string;
    supplierId: string | null;
    performedBy: string;
  },
) {
  const available = await availablePassQty(tx, input.plantId, input.materialId);
  if (available >= toMilli(MIN_AVAILABLE_KG)) return { skipped: true as const };

  const need = toMilli(TARGET_AVAILABLE_KG) - available;
  if (need <= 0n) return { skipped: true as const };

  const qty = (Number(need) / 1000).toFixed(3);
  const batchNo = `SEED-${input.materialCode}`.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 48);

  let batch = await tx.materialBatch.findFirst({
    where: { plantId: input.plantId, batchNo },
  });
  if (!batch) {
    batch = await tx.materialBatch.create({
      data: {
        id: uuidv7(),
        plantId: input.plantId,
        materialId: input.materialId,
        locationId: input.locationId,
        batchNo,
        weight: qty,
        qualityStatus: "pass",
        supplierId: input.supplierId,
        isDemo: true,
      },
    });
  }

  await postMovement(tx, {
    plantId: input.plantId,
    batchId: batch.id,
    locationId: input.locationId,
    type: "adjust",
    qty,
    uom: input.uom,
    reason: "Demo seed stock",
    referenceType: "seed",
    referenceId: batch.id,
    performedBy: input.performedBy,
  });
  return { skipped: false as const, batchNo, qty };
}

export async function seedDemoRawMaterialStock(plantId: string, performedByUserId: string) {
  const location = await prisma.$transaction(
    (tx) => ensureDefaultLocation(tx, plantId),
    TX_OPTS,
  );
  const supplier = await prisma.supplier.findFirst({ where: { plantId }, orderBy: { code: "asc" } });
  const materials = await prisma.materialMaster.findMany({
    where: { plantId, active: true },
    orderBy: { code: "asc" },
  });
  const rawMaterials = materials.filter(isRawMaterial);
  const results: { code: string; batchNo?: string; qty?: string; skipped: boolean }[] = [];

  for (const material of rawMaterials) {
    const result = await prisma.$transaction(
      (tx) =>
        seedMaterialLine(tx, {
          plantId,
          materialId: material.id,
          materialCode: material.code,
          uom: material.uom || "KG",
          locationId: location.id,
          supplierId: supplier?.id ?? null,
          performedBy: performedByUserId,
        }),
      TX_OPTS,
    );
    results.push({
      code: material.code,
      batchNo: result.batchNo,
      qty: result.qty,
      skipped: result.skipped,
    });
  }

  return { plantId, locationCode: location.code, count: rawMaterials.length, results };
}

export async function seedDemoRawMaterialStockAllPlants() {
  const performer =
    (await prisma.user.findFirst({
      where: { userRoles: { some: { role: { code: "admin" } } } },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!performer) throw new Error("No user found to attribute stock movements.");

  const plants = await prisma.plant.findMany({ orderBy: { code: "asc" } });
  const summaries = [];
  for (const plant of plants) {
    summaries.push(await seedDemoRawMaterialStock(plant.id, performer.id));
  }
  return summaries;
}
