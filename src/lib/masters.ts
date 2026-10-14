import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/db";
import { primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";

type CommandTx = Parameters<Parameters<typeof runCommand>[0]["run"]>[0];

export async function createCustomerInTx(
  tx: CommandTx,
  plantId: string,
  input: { name: string; phone?: string | null },
  auditUserId: string,
) {
  const code = await nextNumber(tx, plantId, "CUS");
  const customer = await tx.customer.create({
    data: {
      id: uuidv7(),
      plantId,
      code,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
    },
  });
  await audit(tx, {
    userId: auditUserId,
    action: "customer.create",
    resource: "customer",
    resourceId: customer.id,
  });
  return customer;
}

/** Customer-role portal users without a master record get a Customer row (for sales orders). */
export async function ensurePortalCustomerRecords(plantIds: string[], actingUserId: string) {
  const plantId = plantIds[0];
  if (!plantId) return;

  const orphans = await prisma.user.findMany({
    where: {
      deletedAt: null,
      customerId: null,
      userRoles: { some: { role: { code: "customer" } } },
    },
    select: { id: true, name: true, phone: true },
  });
  if (!orphans.length) return;

  await runCommand({
    userId: actingUserId,
    route: "customer.sync_portal",
    key: null,
    run: async (tx) => {
      for (const user of orphans) {
        const customer = await createCustomerInTx(
          tx,
          plantId,
          { name: user.name, phone: user.phone },
          actingUserId,
        );
        await tx.user.update({ where: { id: user.id }, data: { customerId: customer.id } });
      }
      return { synced: orphans.length };
    },
  });
}

function allow(session: SessionUser, code: string) {
  if (!session.permissions.has(code)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}

export async function createMachine(
  session: SessionUser,
  input: { code: string; name: string; machineType: string; departmentId?: string; readingRequired?: boolean },
  key: string | null,
) {
  allow(session, "machine.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "machine.create",
    key,
    run: async (tx) => {
      const code = input.code.trim();
      const duplicate = await tx.machine.findFirst({ where: { plantId, code: { equals: code, mode: "insensitive" } } });
      if (duplicate) throw new AppError(409, "DUPLICATE", "That machine code is already used.");
      const departmentId = input.departmentId || null;
      if (departmentId) {
        const department = await tx.department.findFirst({ where: { id: departmentId, plantId } });
        if (!department) throw new AppError(404, "NOT_FOUND", "Department was not found.");
      }
      const machine = await tx.machine.create({
        data: {
          id: uuidv7(),
          plantId,
          departmentId,
          code,
          name: input.name.trim(),
          machineType: input.machineType.trim().toLowerCase(),
          readingRequired: input.readingRequired ?? true,
          status: "idle",
        },
      });
      await audit(tx, { userId: session.userId, action: "machine.create", resource: "machine", resourceId: machine.id });
      return { id: machine.id, code: machine.code };
    },
  });
}

export async function createDie(
  session: SessionUser,
  input: { code: string; name: string; dieType: string; lifeLimit?: string },
  key: string | null,
) {
  allow(session, "machine.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "die.create",
    key,
    run: async (tx) => {
      const code = input.code.trim();
      const duplicate = await tx.die.findFirst({ where: { plantId, code: { equals: code, mode: "insensitive" } } });
      if (duplicate) throw new AppError(409, "DUPLICATE", "That die code is already used.");
      const lifeLimit = input.lifeLimit ? Number(input.lifeLimit) : 100000;
      const die = await tx.die.create({
        data: { id: uuidv7(), plantId, code, name: input.name.trim(), dieType: input.dieType.trim().toLowerCase(), lifeLimit, status: "available" },
      });
      await audit(tx, { userId: session.userId, action: "die.create", resource: "die", resourceId: die.id });
      return { id: die.id, code: die.code };
    },
  });
}

export async function createCustomer(session: SessionUser, input: { name: string; phone?: string }, key: string | null) {
  allow(session, "dispatch.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "customer.create",
    key,
    run: async (tx) => {
      const customer = await createCustomerInTx(
        tx,
        plantId,
        { name: input.name, phone: input.phone },
        session.userId,
      );
      return { id: customer.id, code: customer.code };
    },
  });
}
