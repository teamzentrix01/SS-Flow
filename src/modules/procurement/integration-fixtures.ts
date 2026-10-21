import { prisma } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { uuidv7 } from "@/lib/ids";

export const INTEGRATION_ENABLED = process.env.PROCUREMENT_INTEGRATION === "1";

export type FixtureIds = {
  plantId: string;
  supplierId: string;
  materialId: string;
  locationId: string;
  userId: string;
  orderIds: string[];
  receiptIds: string[];
  batchIds: string[];
};

export function testSession(plantId: string, userId: string): SessionUser {
  const permissions = new Set([
    "purchase.manage",
    "purchase.submit",
    "purchase.approve",
    "purchase.cancel",
    "inventory.receive",
  ]);
  return {
    userId,
    email: "procurement-integration@test.local",
    name: "Procurement Integration",
    employeeId: null,
    plantIds: [plantId],
    permissions,
    roles: new Set(["admin"]),
  };
}

export async function loadProcurementFixture(runId: string): Promise<FixtureIds> {
  const plant = await prisma.plant.findFirst({ where: { code: "PLANT-01" } });
  if (!plant) throw new Error("Seed plant PLANT-01 is required for integration tests.");
  const material = await prisma.materialMaster.findFirst({
    where: { plantId: plant.id, code: "RM-COIL", purchaseAllowed: true },
  });
  if (!material) throw new Error("Seed material RM-COIL is required.");
  const location = await prisma.storageLocation.findFirst({
    where: { warehouse: { plantId: plant.id, code: "WH-01" }, code: "A-01" },
  });
  if (!location) throw new Error("Seed location WH-01 / A-01 is required.");
  const userId = uuidv7();
  await prisma.user.create({
    data: {
      id: userId,
      email: `proc-int-${runId}@test.local`,
      name: "Procurement Integration",
      passwordHash: "unused",
    },
  });
  await prisma.userPlantAccess.create({ data: { userId, plantId: plant.id } });
  const supplier = await prisma.supplier.create({
    data: {
      id: uuidv7(),
      plantId: plant.id,
      code: `T-SUP-${runId.slice(0, 8)}`,
      name: `Integration Supplier ${runId.slice(0, 8)}`,
    },
  });
  return {
    plantId: plant.id,
    supplierId: supplier.id,
    materialId: material.id,
    locationId: location.id,
    userId,
    orderIds: [],
    receiptIds: [],
    batchIds: [],
  };
}

export async function teardownProcurementFixture(ids: FixtureIds) {
  if (ids.receiptIds.length) {
    const lines = await prisma.goodsReceiptItem.findMany({
      where: { receiptId: { in: ids.receiptIds } },
      select: { id: true, batchId: true },
    });
    const lineIds = lines.map((row) => row.id);
    const batchIds = [...new Set(lines.map((row) => row.batchId).filter(Boolean) as string[])];
    if (lineIds.length) {
      await prisma.stockLedger.deleteMany({ where: { referenceLineId: { in: lineIds } } });
    }
    if (batchIds.length) {
      await prisma.stockBalance.deleteMany({ where: { batchId: { in: batchIds } } });
      await prisma.qcInspection.deleteMany({ where: { batchId: { in: batchIds } } });
      await prisma.materialBatch.deleteMany({ where: { id: { in: batchIds } } });
    }
    await prisma.goodsReceiptItem.deleteMany({ where: { receiptId: { in: ids.receiptIds } } });
    await prisma.goodsReceipt.deleteMany({ where: { id: { in: ids.receiptIds } } });
  }
  if (ids.orderIds.length) {
    await prisma.purchaseOrderItem.deleteMany({ where: { orderId: { in: ids.orderIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: ids.orderIds } } });
  }
  await prisma.idempotencyKey.deleteMany({ where: { userId: ids.userId } });
  await prisma.auditEvent.deleteMany({ where: { userId: ids.userId } });
  await prisma.userPlantAccess.deleteMany({ where: { userId: ids.userId } });
  await prisma.user.deleteMany({ where: { id: ids.userId } });
  await prisma.supplier.deleteMany({ where: { id: ids.supplierId } });
}
