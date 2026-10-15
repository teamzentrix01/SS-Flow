import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { applyMovement, type MovementType } from "../domain/buckets";
import { fromMilli, toMilli } from "../domain/qty";
import { AppError, stockError } from "../errors";
import { uuidv7 } from "../ids";

type Tx = Prisma.TransactionClient;

function qtyText(value: { toString(): string }) {
  return value.toString();
}

export async function runCommand<T extends Prisma.InputJsonObject>(options: {
  userId: string;
  route: string;
  key: string | null;
  run: (tx: Tx) => Promise<T>;
}): Promise<T> {
  if (!options.key) {
    throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header.");
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.idempotencyKey.findUnique({
          where: {
            userId_route_key: {
              userId: options.userId,
              route: options.route,
              key: options.key!,
            },
          },
        });
        if (existing) return existing.response as T;
        const result = await options.run(tx);
        await tx.idempotencyKey.create({
          data: {
            id: uuidv7(),
            userId: options.userId,
            route: options.route,
            key: options.key!,
            response: result,
          },
        });
        return result;
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { userId_route_key: { userId: options.userId, route: options.route, key: options.key } },
      });
      if (existing) return existing.response as T;
    }
    throw error;
  }
}

async function lockBalance(tx: Tx, plantId: string, batchId: string, locationId: string, uom: string) {
  await tx.stockBalance.upsert({
    where: { batchId_locationId: { batchId, locationId } },
    create: {
      id: uuidv7(),
      plantId,
      batchId,
      locationId,
      uom,
    },
    update: {},
  });
  const row = await tx.stockBalance.findUnique({
    where: { batchId_locationId: { batchId, locationId } },
  });
  if (!row) throw new AppError(500, "STOCK_MISSING", "Stock balance could not be locked.");
  return row;
}

export async function postMovement(
  tx: Tx,
  input: {
    plantId: string;
    batchId: string;
    locationId: string;
    destLocationId?: string | null;
    type: MovementType;
    qty: string;
    uom?: string;
    reason?: string;
    referenceType?: string;
    referenceId?: string;
    performedBy: string;
  },
) {
  const qty = toMilli(input.qty);
  const uom = input.uom ?? "KG";
  const row = await lockBalance(tx, input.plantId, input.batchId, input.locationId, uom);
  let next;
  try {
    next = applyMovement(
      {
        available: toMilli(qtyText(row.availableQty)),
        reserved: toMilli(qtyText(row.reservedQty)),
        qcHold: toMilli(qtyText(row.qcHoldQty)),
        wip: toMilli(qtyText(row.wipQty)),
        finished: toMilli(qtyText(row.finishedQty)),
        scrap: toMilli(qtyText(row.scrapQty)),
        rejected: toMilli(qtyText(row.rejectedQty)),
      },
      input.type,
      qty,
    );
  } catch (error) {
    stockError(error);
  }
  await tx.stockBalance.update({
    where: { id: row.id },
    data: {
      availableQty: fromMilli(next.available),
      reservedQty: fromMilli(next.reserved),
      qcHoldQty: fromMilli(next.qcHold),
      wipQty: fromMilli(next.wip),
      finishedQty: fromMilli(next.finished),
      scrapQty: fromMilli(next.scrap),
      rejectedQty: fromMilli(next.rejected),
    },
  });
  const ledger = await tx.stockLedger.create({
    data: {
      id: uuidv7(),
      plantId: input.plantId,
      batchId: input.batchId,
      locationId: input.locationId,
      destLocationId: input.destLocationId ?? null,
      movementType: input.type,
      qty: fromMilli(qty < 0n ? -qty : qty),
      uom,
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      performedBy: input.performedBy,
    },
  });
  return { ledgerId: ledger.id };
}

export async function nextNumber(tx: Tx, plantId: string, prefix: string) {
  const year = new Date().getFullYear();
  const row = await tx.numberSequence.upsert({
    where: { plantId_prefix_year: { plantId, prefix, year } },
    create: { plantId, prefix, year, value: 1 },
    update: { value: { increment: 1 } },
  });
  const value = row.value;
  return `${prefix}-${year}-${String(value).padStart(5, "0")}`;
}

export async function addDaily(tx: Tx, plantId: string, receipts: string, output: string, scrap: string) {
  const now = new Date();
  const day = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  await tx.plantDailyStat.upsert({
    where: { plantId_day: { plantId, day } },
    create: { plantId, day, receiptsKg: receipts, outputKg: output, scrapKg: scrap },
    update: {
      receiptsKg: { increment: receipts },
      outputKg: { increment: output },
      scrapKg: { increment: scrap },
    },
  });
}

export async function audit(
  tx: Tx,
  input: { userId: string; action: string; resource: string; resourceId?: string; reason?: string; payload?: Prisma.InputJsonObject },
) {
  await tx.auditEvent.create({
    data: {
      id: uuidv7(),
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      reason: input.reason,
      payload: input.payload ?? {},
    },
  });
}

export async function notifyUsers(
  tx: Tx,
  input: { userIds: string[]; type: string; title: string; body: string; href?: string; payload?: Prisma.InputJsonObject },
) {
  const unique = [...new Set(input.userIds)];
  if (unique.length) {
    await tx.notification.createMany({
      data: unique.map((userId) => ({
        id: uuidv7(),
        userId,
        title: input.title,
        body: input.body,
        href: input.href,
      })),
    });
  }
  await tx.outbox.create({
    data: {
      id: uuidv7(),
      type: input.type,
      payload: { ...(input.payload ?? {}), title: input.title, userIds: unique },
      deliveredAt: new Date(),
    },
  });
}

export async function usersWithPermission(tx: Tx, plantId: string, permission: string) {
  const rows = await tx.user.findMany({
    where: {
      disabledAt: null,
      plantAccess: { some: { plantId } },
      userRoles: { some: { role: { permissions: { some: { permission: { code: permission } } } } } },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
