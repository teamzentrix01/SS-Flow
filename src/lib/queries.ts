import { prisma } from "@/db";
import { qtyText } from "@/lib/domain/qty";

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function dashboardData(plantIds: string[]) {
  const [stat, balances, activeJobs, delayedJobs, pendingApprovals, machines, inspections] = await Promise.all([
    prisma.plantDailyStat.findMany({ where: { plantId: { in: plantIds }, day: today() } }),
    prisma.stockBalance.groupBy({
      by: ["plantId"],
      where: { plantId: { in: plantIds } },
      _sum: { availableQty: true, reservedQty: true, qcHoldQty: true, wipQty: true, finishedQty: true, scrapQty: true },
    }),
    prisma.jobCard.count({ where: { plantId: { in: plantIds }, status: { in: ["ready", "assigned", "in_progress", "paused"] } } }),
    prisma.jobCard.count({ where: { plantId: { in: plantIds }, status: { notIn: ["closed", "cancelled", "draft"] }, plannedEnd: { lt: new Date() } } }),
    prisma.jobCard.count({ where: { plantId: { in: plantIds }, status: "submitted" } }),
    prisma.machine.groupBy({ by: ["status"], where: { plantId: { in: plantIds } }, _count: true }),
    prisma.qcInspection.count({ where: { plantId: { in: plantIds }, status: "pending" } }),
  ]);
  const sum = balances[0]?._sum;
  return {
    receipts: qtyText(stat[0]?.receiptsKg),
    output: qtyText(stat[0]?.outputKg),
    scrap: qtyText(stat[0]?.scrapKg),
    available: qtyText(sum?.availableQty),
    reserved: qtyText(sum?.reservedQty),
    hold: qtyText(sum?.qcHoldQty),
    wip: qtyText(sum?.wipQty),
    finished: qtyText(sum?.finishedQty),
    activeJobs,
    delayedJobs,
    pendingApprovals,
    pendingQc: inspections,
    machines: Object.fromEntries(machines.map((row) => [row.status, row._count])),
  };
}

export async function listBalances(plantIds: string[]) {
  const rows = await prisma.stockBalance.findMany({
    where: { plantId: { in: plantIds } },
    include: { batch: { include: { material: true } }, location: { include: { warehouse: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    batchId: row.batchId,
    batchNo: row.batch.batchNo,
    material: row.batch.material.name,
    grade: row.batch.grade ?? "—",
    thickness: row.batch.thickness?.toString() ?? "—",
    heat: row.batch.heatNo ?? "—",
    location: `${row.location.warehouse.code} / ${row.location.code}`,
    available: qtyText(row.availableQty),
    reserved: qtyText(row.reservedQty),
    hold: qtyText(row.qcHoldQty),
    wip: qtyText(row.wipQty),
    finished: qtyText(row.finishedQty),
    scrap: qtyText(row.scrapQty),
  }));
}

export async function listMovements(plantIds: string[], cursor?: string) {
  const rows = await prisma.stockLedger.findMany({
    where: { plantId: { in: plantIds } },
    include: { batch: { select: { batchNo: true } } },
    orderBy: { id: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    nextCursor: rows.length > 50 ? rows[49]?.id ?? null : null,
    rows: rows.slice(0, 50).map((row) => ({
      id: row.id,
      when: row.createdAt.toISOString(),
      batch: row.batch.batchNo,
      type: row.movementType,
      qty: qtyText(row.qty),
      reason: row.reason ?? "—",
    })),
  };
}

export async function batchDetail(id: string, plantIds: string[]) {
  const batch = await prisma.materialBatch.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { material: true, location: true, balances: true },
  });
  if (!batch) return null;
  const [parents, children, ledger, audits] = await Promise.all([
    prisma.$queryRaw<{ batch_no: string; qty: string; link_type: string; depth: number }[]>`
      WITH RECURSIVE chain AS (
        SELECT parent_batch_id, qty::text, link_type, 1 AS depth
        FROM batch_links WHERE child_batch_id = CAST(${id} AS uuid)
        UNION ALL
        SELECT b.parent_batch_id, b.qty::text, b.link_type, c.depth + 1
        FROM batch_links b JOIN chain c ON b.child_batch_id = c.parent_batch_id
        WHERE c.depth < 20
      )
      SELECT mb.batch_no, chain.qty, chain.link_type, chain.depth
      FROM chain JOIN material_batches mb ON mb.id = chain.parent_batch_id
      ORDER BY chain.depth
    `,
    prisma.batchLink.findMany({ where: { parentBatchId: id }, include: { child: { select: { batchNo: true } } } }),
    prisma.stockLedger.findMany({ where: { batchId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.auditEvent.findMany({ where: { resourceId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return {
    id: batch.id,
    batchNo: batch.batchNo,
    material: batch.material.name,
    shape: batch.material.shape,
    grade: batch.grade,
    thickness: batch.thickness?.toString() ?? "—",
    width: batch.width?.toString() ?? "—",
    heat: batch.heatNo,
    weight: qtyText(batch.weight),
    quality: batch.qualityStatus,
    locationId: batch.locationId,
    parents,
    children: children.map((link) => ({ batchNo: link.child.batchNo, qty: qtyText(link.qty), type: link.linkType })),
    balances: batch.balances.map((row) => ({ available: qtyText(row.availableQty), reserved: qtyText(row.reservedQty), hold: qtyText(row.qcHoldQty), wip: qtyText(row.wipQty), finished: qtyText(row.finishedQty), scrap: qtyText(row.scrapQty) })),
    ledger: ledger.map((row) => ({ id: row.id, type: row.movementType, qty: qtyText(row.qty), when: row.createdAt.toISOString() })),
    audits: audits.map((row) => ({ action: row.action, when: row.createdAt.toISOString(), reason: row.reason })),
  };
}

export async function listSuppliers(plantIds: string[]) {
  return prisma.supplier.findMany({ where: { plantId: { in: plantIds } }, orderBy: { name: "asc" } });
}

export async function listMaterials(plantIds: string[]) {
  return prisma.materialMaster.findMany({ where: { plantId: { in: plantIds }, active: true }, orderBy: { name: "asc" } });
}

export async function listOrders(plantIds: string[]) {
  return prisma.purchaseOrder.findMany({
    where: { plantId: { in: plantIds } },
    include: { supplier: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function orderDetail(id: string, plantIds: string[]) {
  return prisma.purchaseOrder.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { supplier: true, items: true, receipts: true },
  });
}

export async function listLocations(plantIds: string[]) {
  return prisma.storageLocation.findMany({ where: { warehouse: { plantId: { in: plantIds } } }, include: { warehouse: true }, orderBy: { code: "asc" } });
}

export async function listInspections(plantIds: string[]) {
  return prisma.qcInspection.findMany({
    where: { plantId: { in: plantIds } },
    include: { batch: true, job: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function inspectionDetail(id: string, plantIds: string[]) {
  return prisma.qcInspection.findFirst({ where: { id, plantId: { in: plantIds } }, include: { batch: { include: { material: true } }, job: true } });
}

export async function listProduction(plantIds: string[]) {
  return prisma.productionOrder.findMany({
    where: { plantId: { in: plantIds } },
    include: { product: true, jobs: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function productionDetail(id: string, plantIds: string[]) {
  return prisma.productionOrder.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { product: true, jobs: { orderBy: { sequence: "asc" }, include: { assignee: true, machine: true, predecessors: { include: { predecessor: true } } } } },
  });
}

export async function listJobs(plantIds: string[]) {
  return prisma.jobCard.findMany({
    where: { plantId: { in: plantIds } },
    include: { assignee: true, machine: true, predecessors: { include: { predecessor: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function jobDetail(id: string, plantIds: string[], employeeId?: string | null) {
  return prisma.jobCard.findFirst({
    where: { id, plantId: { in: plantIds }, ...(employeeId ? { assigneeId: employeeId } : {}) },
    include: {
      assignee: { include: { shift: true } },
      machine: true,
      die: true,
      batch: { include: { material: true } },
      supervisor: true,
      submissions: { orderBy: { version: "desc" } },
      predecessors: { include: { predecessor: true } },
      productionOrder: { include: { product: true } },
    },
  });
}

export async function myJobs(employeeId: string) {
  return prisma.jobCard.findMany({
    where: { assigneeId: employeeId },
    include: { machine: true, batch: true, predecessors: { include: { predecessor: true } } },
    orderBy: { sequence: "asc" },
  });
}

export async function listMachines(plantIds: string[]) {
  return prisma.machine.findMany({ where: { plantId: { in: plantIds } }, orderBy: { code: "asc" } });
}

export async function machineDetail(id: string, plantIds: string[]) {
  return prisma.machine.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { downtime: { orderBy: { startedAt: "desc" }, take: 10 }, jobs: { where: { status: { in: ["ready", "in_progress", "paused"] } }, take: 5 } },
  });
}

export async function listDies(plantIds: string[]) {
  return prisma.die.findMany({ where: { plantId: { in: plantIds } }, orderBy: { code: "asc" } });
}

export async function listEmployees(plantIds: string[]) {
  return prisma.employee.findMany({
    where: { plantId: { in: plantIds } },
    include: { shift: true, department: true, user: { include: { userRoles: { include: { role: true } } } } },
    orderBy: { name: "asc" },
  });
}

export async function getEmployee(id: string, plantIds: string[]) {
  return prisma.employee.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      shift: true,
      department: true,
      supervisor: { select: { id: true, name: true, code: true } },
      assignedMachine: { select: { id: true, name: true, code: true } },
      user: { include: { userRoles: { include: { role: true } } } },
    },
  });
}

export async function listShifts(plantIds: string[]) {
  return prisma.shift.findMany({ where: { plantId: { in: plantIds } } });
}

export async function listDepartments(plantIds: string[]) {
  return prisma.department.findMany({ where: { plantId: { in: plantIds } }, orderBy: { name: "asc" } });
}

export async function listCustomers(plantIds: string[]) {
  return prisma.customer.findMany({ where: { plantId: { in: plantIds } }, orderBy: { name: "asc" } });
}

export async function listShipments(plantIds: string[]) {
  return prisma.shipment.findMany({ where: { plantId: { in: plantIds } }, include: { order: { include: { customer: true } }, items: true }, orderBy: { shippedAt: "desc" }, take: 20 });
}

export async function listMaintenance(plantIds: string[]) {
  return prisma.maintenanceWorkOrder.findMany({ where: { plantId: { in: plantIds } }, include: { machine: true }, orderBy: { createdAt: "desc" }, take: 30 });
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function plantSetup(plantIds: string[]) {
  const [plants, departments, warehouses, shifts] = await Promise.all([
    prisma.plant.findMany({ where: { id: { in: plantIds } } }),
    prisma.department.findMany({ where: { plantId: { in: plantIds } } }),
    prisma.warehouse.findMany({ where: { plantId: { in: plantIds } }, include: { locations: true } }),
    prisma.shift.findMany({ where: { plantId: { in: plantIds } } }),
  ]);
  return { plants, departments, warehouses, shifts };
}

export async function availableBatches(plantIds: string[]) {
  const rows = await prisma.stockBalance.findMany({
    where: { plantId: { in: plantIds }, availableQty: { gt: 0 } },
    include: { batch: { include: { material: true } } },
    take: 50,
  });
  return rows.map((row) => ({ id: row.batchId, label: `${row.batch.batchNo} · ${row.batch.material.name} · ${qtyText(row.availableQty)}`, locationId: row.locationId }));
}

export async function finishedBatches(plantIds: string[]) {
  const rows = await prisma.stockBalance.findMany({
    where: { plantId: { in: plantIds }, finishedQty: { gt: 0 }, batch: { qualityStatus: "pass" } },
    include: { batch: true },
    take: 50,
  });
  return rows.map((row) => ({ id: row.batchId, label: `${row.batch.batchNo} · ${qtyText(row.finishedQty)} finished` }));
}

export async function listSalesOrders(plantIds: string[]) {
  return prisma.salesOrder.findMany({
    where: { plantId: { in: plantIds } },
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function salesOrderDetail(id: string, plantIds: string[]) {
  return prisma.salesOrder.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      customer: true,
      items: { include: { product: true } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      requirements: { include: { material: true } },
      productionOrders: true,
    },
  });
}

export async function activeBom(productId: string, plantIds: string[]) {
  return prisma.bomHeader.findFirst({
    where: { productId, plantId: { in: plantIds }, active: true },
    include: { items: { include: { material: true } }, product: true },
    orderBy: { version: "desc" },
  });
}

export async function listUtensilProducts(plantIds: string[]) {
  return prisma.materialMaster.findMany({
    where: { plantId: { in: plantIds }, active: true, category: { in: ["utensil", "semi", "raw", "consumable"] } },
    include: { productCategory: { select: { name: true, code: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listProductsForDesk(plantIds: string[]) {
  return prisma.materialMaster.findMany({
    where: { plantId: { in: plantIds } },
    include: { productCategory: { select: { name: true, code: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getMaterialMaster(id: string, plantIds: string[]) {
  return prisma.materialMaster.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { productCategory: true },
  });
}

export async function listMaterialRequests(plantIds: string[]) {
  return prisma.materialRequest.findMany({
    where: { plantId: { in: plantIds } },
    include: { material: true, employee: true, job: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listRequisitions(plantIds: string[]) {
  return prisma.purchaseRequisition.findMany({
    where: { plantId: { in: plantIds } },
    include: { items: { include: { material: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function openSalesLinesForDispatch(plantIds: string[], customerId: string) {
  return prisma.salesOrderItem.findMany({
    where: {
      order: { plantId: { in: plantIds }, customerId, status: { in: ["production", "partially_dispatched", "ready_for_dispatch"] } },
    },
    include: { product: true, order: true },
    take: 50,
  });
}
