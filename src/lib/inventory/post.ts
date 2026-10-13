import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { applyMovement, bucketsFromRow, type MovementType } from "../domain/buckets";
import { fromMilli, toMilli } from "../domain/qty";
import { AppError, stockError } from "../errors";
import { uuidv7 } from "../ids";

type Tx = Prisma.TransactionClient;

type BalanceRow = {
  id: string;
  available_qty: string;
  reserved_qty: string;
  qc_hold_qty: string;
  wip_qty: string;
  finished_qty: string;
  scrap_qty: string;
  rejected_qty: string;
};

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
  const id = uuidv7();
  await tx.$executeRaw`
    INSERT INTO stock_balances (
      id, plant_id, batch_id, location_id, uom,
      available_qty, reserved_qty, qc_hold_qty, wip_qty, finished_qty, scrap_qty, rejected_qty, updated_at
    ) VALUES (
      CAST(${id} AS uuid), CAST(${plantId} AS uuid), CAST(${batchId} AS uuid), CAST(${locationId} AS uuid),
      ${uom}, 0, 0, 0, 0, 0, 0, 0, NOW()
    )
    ON CONFLICT (batch_id, location_id) DO NOTHING
  `;
  const rows = await tx.$queryRaw<BalanceRow[]>`
    SELECT id::text, available_qty::text, reserved_qty::text, qc_hold_qty::text,
           wip_qty::text, finished_qty::text, scrap_qty::text, rejected_qty::text
    FROM stock_balances
    WHERE batch_id = CAST(${batchId} AS uuid) AND location_id = CAST(${locationId} AS uuid)
    FOR UPDATE
  `;
  const row = rows[0];
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
    next = applyMovement(bucketsFromRow(row), input.type, qty);
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
  await tx.$executeRaw`
    INSERT INTO plant_daily_stats (plant_id, day, receipts_kg, output_kg, scrap_kg)
    VALUES (CAST(${plantId} AS uuid), ${day}::date, ${receipts}::numeric, ${output}::numeric, ${scrap}::numeric)
    ON CONFLICT (plant_id, day) DO UPDATE SET
      receipts_kg = plant_daily_stats.receipts_kg + EXCLUDED.receipts_kg,
      output_kg = plant_daily_stats.output_kg + EXCLUDED.output_kg,
      scrap_kg = plant_daily_stats.scrap_kg + EXCLUDED.scrap_kg
  `;
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
