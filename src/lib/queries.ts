import { prisma } from "@/db";
import { requiredMaterialsForJob } from "@/modules/production/job-material";
import { checkMaterialCompatibility } from "@/lib/domain/material-compatibility";
import { qtyText, toMilli } from "@/lib/domain/qty";
import { notDeleted } from "@/lib/soft-delete";

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
      _sum: { availableQty: true, reservedQty: true, qcHoldQty: true, wipQty: true, finishedQty: true, scrapQty: true, rejectedQty: true, inTransitQty: true },
    }),
    prisma.jobCard.count({ where: { plantId: { in: plantIds }, status: { in: ["ready", "assigned", "in_progress", "paused"] } } }),
    prisma.jobCard.count({ where: { plantId: { in: plantIds }, status: { notIn: ["closed", "cancelled", "draft"] }, plannedEnd: { lt: new Date() } } }),
    prisma.jobCard.count({ where: { plantId: { in: plantIds }, status: "submitted" } }),
    prisma.machine.groupBy({ by: ["status"], where: { plantId: { in: plantIds } }, _count: true }),
    prisma.qcInspection.count({ where: { plantId: { in: plantIds }, status: "pending" } }),
  ]);
  const sumQty = (key: "availableQty" | "reservedQty" | "qcHoldQty" | "wipQty" | "finishedQty" | "scrapQty" | "rejectedQty" | "inTransitQty") =>
    qtyText(balances.reduce((total, row) => total + Number(row._sum[key] ?? 0), 0));
  return {
    receipts: qtyText(stat.reduce((total, row) => total + Number(row.receiptsKg), 0)),
    output: qtyText(stat.reduce((total, row) => total + Number(row.outputKg), 0)),
    scrap: qtyText(stat.reduce((total, row) => total + Number(row.scrapKg), 0)),
    available: sumQty("availableQty"),
    reserved: sumQty("reservedQty"),
    hold: sumQty("qcHoldQty"),
    wip: sumQty("wipQty"),
    finished: sumQty("finishedQty"),
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
    include: { batch: { select: { batchNo: true, id: true } } },
    orderBy: { id: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    nextCursor: rows.length > 50 ? rows[49]?.id ?? null : null,
    rows: rows.slice(0, 50).map((row) => ({
      id: row.id,
      batchId: row.batchId,
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
    include: {
      material: true,
      location: true,
      balances: { include: { location: { include: { warehouse: true } } } },
      receiptItems: {
        include: {
          receipt: { include: { order: { include: { supplier: true } } } },
          orderItem: true,
        },
      },
      productionIssues: { include: { job: { select: { id: true, number: true, name: true } }, requestedMaterial: { select: { name: true, code: true } }, substitutionRequest: { select: { id: true, status: true, reason: true, approvedBy: true, decidedAt: true } } } },
    },
  });
  if (!batch) return null;
  const [parents, children, ledger, audits] = await Promise.all([
    prisma.$transaction(async (tx) => {
      const { withPgSchema } = await import("@/lib/db/pg-schema");
      return withPgSchema(tx, () =>
        tx.$queryRaw<{ batch_no: string; qty: string; link_type: string; depth: number }[]>`
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
      );
    }),
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
    supplierBatchNo: batch.supplierBatchNo,
    receivedQty: batch.receivedQty?.toString() ?? null,
    receivedUom: batch.receivedUom,
    actualWeightKg: batch.actualWeightKg?.toString() ?? null,
    sources: batch.receiptItems.map((item) => ({
      receiptNo: item.receipt.number,
      purchaseOrderNo: item.receipt.order.number,
      supplier: item.receipt.order.supplier.name,
      acceptedQty: qtyText(item.acceptedQty),
      rejectedQty: qtyText(item.rejectedQty),
      uom: item.uom,
      rate: qtyText(item.orderItem.rate),
      grade: item.grade,
      thickness: item.thickness?.toString() ?? null,
      width: item.width?.toString() ?? null,
      length: item.length?.toString() ?? null,
      diameter: item.diameter?.toString() ?? null,
      finish: item.finish,
    })),
    issues: batch.productionIssues.map((issue) => ({
      jobNo: issue.job?.number ?? "—",
      jobName: issue.job?.name ?? "—",
      requestedMaterial: issue.requestedMaterial?.name ?? issue.materialMasterId,
      substitution: issue.substitutionRequest ? `${issue.substitutionRequest.status}: ${issue.substitutionRequest.reason}` : null,
      substitutionApprovedBy: issue.substitutionRequest?.approvedBy ?? null,
      substitutionDecidedAt: issue.substitutionRequest?.decidedAt?.toISOString() ?? null,
      issued: qtyText(issue.quantityIssued),
      consumed: qtyText(issue.quantityConsumed),
      returned: qtyText(issue.quantityReturned),
    })),
    quality: batch.qualityStatus,
    locationId: batch.locationId,
    parents,
    children: children.map((link) => ({ batchNo: link.child.batchNo, qty: qtyText(link.qty), type: link.linkType })),
    balances: batch.balances.map((row) => ({
      location: `${row.location.warehouse.code} / ${row.location.code}`,
      uom: row.uom,
      available: qtyText(row.availableQty), reserved: qtyText(row.reservedQty), hold: qtyText(row.qcHoldQty), wip: qtyText(row.wipQty), finished: qtyText(row.finishedQty), scrap: qtyText(row.scrapQty), rejected: qtyText(row.rejectedQty),
    })),
    ledger: ledger.map((row) => ({ id: row.id, type: row.movementType, qty: qtyText(row.qty), when: row.createdAt.toISOString() })),
    audits: audits.map((row) => ({ action: row.action, when: row.createdAt.toISOString(), reason: row.reason })),
  };
}

export async function listSuppliers(plantIds: string[]) {
  return prisma.supplier.findMany({
    where: { plantId: { in: plantIds } },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
  });
}

/** All suppliers in the company — used for PO and supplier master lists (not scoped to one factory). */
export async function listAllSuppliers() {
  return prisma.supplier.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    include: { plant: { select: { id: true, name: true } } },
  });
}

export async function listMaterials(plantIds: string[], options?: { categoryId?: string; purchaseOnly?: boolean }) {
  return prisma.materialMaster.findMany({
    where: {
      plantId: { in: plantIds },
      active: true,
      ...(options?.purchaseOnly !== false ? { purchaseAllowed: true } : {}),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
    },
    include: { productCategory: { select: { id: true, name: true, code: true } } },
    orderBy: { name: "asc" },
  });
}

/** Stock SKUs / materials for the whole company (not tied to one receiving factory). */
export async function listAllMaterials(options?: { categoryId?: string; purchaseOnly?: boolean }) {
  return prisma.materialMaster.findMany({
    where: {
      active: true,
      ...(options?.purchaseOnly !== false ? { purchaseAllowed: true } : {}),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
    },
    include: {
      productCategory: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
}

export async function listPlants(plantIds: string[]) {
  return prisma.plant.findMany({ where: { id: { in: plantIds } }, orderBy: { name: "asc" } });
}

export async function listOrders(
  plantIds: string[],
  filters?: {
    supplierId?: string;
    plantId?: string;
    status?: string;
    categoryId?: string;
    materialId?: string;
    from?: string;
    to?: string;
  },
) {
  const createdAt =
    filters?.from || filters?.to
      ? {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
      }
      : undefined;
  const plantId = filters?.plantId?.trim() || undefined;
  const supplierId = filters?.supplierId?.trim() || undefined;
  const status = filters?.status?.trim() || undefined;
  const materialId = filters?.materialId?.trim() || undefined;
  const categoryId = filters?.categoryId?.trim() || undefined;
  return prisma.purchaseOrder.findMany({
    where: {
      ...(plantId ? { plantId } : { plantId: { in: plantIds } }),
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(materialId || categoryId
        ? {
          items: {
            some: {
              ...(materialId ? { materialId } : {}),
              ...(categoryId ? { material: { categoryId } } : {}),
            },
          },
        }
        : {}),
    },
    include: { supplier: true, plant: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function orderDetail(id: string, plantIds: string[]) {
  return prisma.purchaseOrder.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      supplier: true,
      plant: true,
      items: {
        include: {
          material: { include: { productCategory: true } },
          receiptItems: {
            include: {
              receipt: { select: { id: true, number: true, status: true, postedAt: true } },
              batch: {
                include: {
                  balances: true,
                  inspections: true,
                },
              },
            },
          },
        },
      },
      receipts: { include: { items: true }, orderBy: { receivedAt: "desc" } },
    },
  });
}

export async function receiptDetail(id: string, plantIds: string[]) {
  return prisma.goodsReceipt.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      plant: true,
      intendedPlant: true,
      order: { include: { supplier: true, plant: true } },
      items: { include: { orderItem: true } },
    },
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

/** Production orders with all routing steps — for the desk job board (one row per order). */
export async function listJobBoardOrders(plantIds: string[]) {
  return prisma.productionOrder.findMany({
    where: { plantId: { in: plantIds }, jobs: { some: {} } },
    include: {
      product: true,
      salesOrder: { select: { id: true, number: true } },
      jobs: {
        orderBy: { sequence: "asc" },
        include: {
          assignee: true,
          machine: true,
          predecessors: { include: { predecessor: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function jobBoardOrderDetail(id: string, plantIds: string[]) {
  return prisma.productionOrder.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      product: true,
      salesOrder: { select: { id: true, number: true } },
      jobs: {
        orderBy: { sequence: "asc" },
        include: {
          assignee: true,
          machine: true,
          die: true,
          submissions: { orderBy: { version: "desc" }, take: 1 },
          statusEvents: { orderBy: { createdAt: "desc" }, take: 8 },
          predecessors: { include: { predecessor: { select: { number: true, name: true, status: true } } } },
        },
      },
    },
  });
}

export async function listJobsPendingApproval(plantIds: string[]) {
  return prisma.jobCard.findMany({
    where: { plantId: { in: plantIds }, status: "submitted" },
    include: {
      assignee: true,
      machine: true,
      salesOrder: { select: { id: true, number: true } },
      productionOrder: { select: { number: true } },
    },
    orderBy: { actualEnd: "desc" },
    take: 100,
  });
}

export async function jobDetail(id: string, plantIds: string[], employeeId?: string | null) {
  return prisma.jobCard.findFirst({
    where: { id, plantId: { in: plantIds }, ...(employeeId ? { assigneeId: employeeId } : {}) },
    include: {
      assignee: { include: { shift: true, department: true } },
      machine: true,
      die: true,
      batch: { include: { material: true } },
      supervisor: true,
      submissions: { orderBy: { version: "desc" } },
      predecessors: { include: { predecessor: true } },
      successors: { include: { successor: true } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      productionOrder: { include: { product: true } },
      materialIssues: { include: { batch: { include: { material: true } }, requestedMaterial: true, substitutionRequest: true }, orderBy: { issuedAt: "asc" } },
      substitutionRequests: { include: { requestedMaterial: true, actualMaterial: true, batch: true, location: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function jobStartMaterialData(jobId: string, plantIds: string[]) {
  const job = await prisma.jobCard.findFirst({ where: { id: jobId, plantId: { in: plantIds } } });
  if (!job) return { candidates: [], substitutionOptions: { requirements: [], batches: [] } };

  const [order, requestedIds] = await Promise.all([
    prisma.productionOrder.findUnique({ where: { id: job.productionOrderId }, select: { sourceBatchId: true } }),
    requiredMaterialsForJob(prisma, job),
  ]);
  const sourceBatchIds = [...new Set([job.batchId, order?.sourceBatchId].filter((id): id is string => Boolean(id)))];
  const stockInclude = { batch: { include: { material: true } }, location: { include: { warehouse: true } } } as const;
  const [requested, candidateBalances, substitutionBalances] = await Promise.all([
    requestedIds.length
      ? prisma.materialMaster.findMany({ where: { id: { in: requestedIds }, plantId: { in: plantIds } }, include: { productCategory: true } })
      : Promise.resolve([]),
    requestedIds.length
      ? prisma.stockBalance.findMany({
          where: { plantId: { in: plantIds }, OR: [{ availableQty: { gt: 0 } }, { batchId: { in: sourceBatchIds }, reservedQty: { gt: 0 } }], batch: { qualityStatus: "pass", materialId: { in: requestedIds } } },
          include: stockInclude, orderBy: [{ updatedAt: "asc" }], take: 100,
        })
      : Promise.resolve([]),
    prisma.stockBalance.findMany({
      where: { plantId: { in: plantIds }, availableQty: { gt: 0 }, batch: { qualityStatus: "pass", materialId: { notIn: requestedIds } } },
      include: stockInclude, orderBy: { updatedAt: "asc" }, take: 100,
    }),
  ]);

  return {
    candidates: candidateBalances.flatMap((balance) => {
      const requirement = requested.find((material) => material.id === balance.batch.materialId);
      if (!requirement) return [];
      const compatible = checkMaterialCompatibility({
        requestedMaterialId: requirement.id,
        actualMaterialId: balance.batch.materialId,
        requestedSpecs: { grade: requirement.grade, thickness: requirement.thickness?.toString(), width: requirement.width?.toString(), length: requirement.length?.toString(), diameter: requirement.diameter?.toString(), productForm: requirement.shape },
        actualSpecs: { grade: balance.batch.grade, thickness: balance.batch.thickness?.toString(), width: balance.batch.width?.toString(), length: balance.batch.length?.toString(), diameter: balance.batch.diameter?.toString(), finish: balance.batch.finish, productForm: balance.batch.material.shape },
        requiredSpecs: requirement.productCategory?.requiredSpecs ?? [],
        requestedUom: requirement.uom,
        actualUom: balance.uom,
      });
      const isJobSource = sourceBatchIds.includes(balance.batchId);
      if (compatible || (toMilli(balance.availableQty.toString()) <= 0n && !(isJobSource && toMilli(balance.reservedQty.toString()) > 0n))) return [];
      return [{
        requestedMaterialId: requirement.id, requestedMaterial: requirement.name,
        batchId: balance.batchId, batchNo: balance.batch.batchNo,
        supplierBatchNo: balance.batch.supplierBatchNo, materialId: balance.batch.materialId,
        material: balance.batch.material.name, locationId: balance.locationId,
        location: `${balance.location.warehouse.code} / ${balance.location.code}`,
        availableQty: qtyText(balance.availableQty), uom: balance.uom,
        reservedQty: qtyText(balance.reservedQty), isJobSource,
        grade: balance.batch.grade, thickness: balance.batch.thickness?.toString() ?? "—",
        width: balance.batch.width?.toString() ?? "—",
      }];
    }),
    substitutionOptions: {
      requirements: requested.filter((material) => material.active).map((material) => ({ id: material.id, name: material.name, uom: material.uom })),
      batches: substitutionBalances.map((balance) => ({
        batchId: balance.batchId, batchNo: balance.batch.batchNo,
        materialId: balance.batch.materialId, material: balance.batch.material.name,
        locationId: balance.locationId, location: `${balance.location.warehouse.code} / ${balance.location.code}`,
        availableQty: qtyText(balance.availableQty), uom: balance.uom,
        grade: balance.batch.grade, thickness: balance.batch.thickness?.toString() ?? "—",
      })),
    },
  };
}

export async function jobMaterialCandidates(jobId: string, plantIds: string[]) {
  const { candidates } = await jobStartMaterialData(jobId, plantIds);
  return candidates;
}

export async function jobSubstitutionOptions(jobId: string, plantIds: string[]) {
  const { substitutionOptions } = await jobStartMaterialData(jobId, plantIds);
  return substitutionOptions;
}

export async function productionOrderJobs(productionOrderId: string, plantIds: string[]) {
  return prisma.jobCard.findMany({
    where: { productionOrderId, plantId: { in: plantIds } },
    orderBy: { sequence: "asc" },
    include: {
      assignee: true,
      predecessors: { include: { predecessor: true } },
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

export async function myOpenShopJobs(employeeId: string) {
  return prisma.jobCard.findMany({
    where: { assigneeId: employeeId, status: { in: ["ready", "in_progress", "paused"] } },
    select: {
      id: true,
      number: true,
      name: true,
      status: true,
      machineId: true,
      batchId: true,
      batch: { select: { batchNo: true } },
      materialIssues: { select: { quantityPlanned: true } },
    },
    orderBy: { sequence: "asc" },
  });
}

export async function listMachines(plantIds: string[]) {
  return prisma.machine.findMany({ where: { plantId: { in: plantIds } }, orderBy: { id: "desc" } });
}

export async function machineDetail(id: string, plantIds: string[]) {
  return prisma.machine.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { downtime: { orderBy: { startedAt: "desc" }, take: 10 }, jobs: { where: { status: { in: ["ready", "in_progress", "paused"] } }, take: 5 } },
  });
}

export async function listDies(plantIds: string[]) {
  return prisma.die.findMany({ where: { plantId: { in: plantIds } }, orderBy: { id: "desc" } });
}

export async function listEmployees(plantIds: string[]) {
  return prisma.employee.findMany({
    where: { plantId: { in: plantIds }, ...notDeleted },
    include: {
      shift: true,
      department: true,
      designationRecord: true,
      user: { include: { userRoles: { include: { role: true } }, plantAccess: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listDeskUsers(plantIds: string[]) {
  return prisma.user.findMany({
    where: {
      ...notDeleted,
      OR: [
        { plantAccess: { some: { plantId: { in: plantIds } } } },
        { customer: { plantId: { in: plantIds } } },
        { supplier: { plantId: { in: plantIds } } },
      ],
    },
    include: {
      userRoles: { include: { role: true } },
      customer: { select: { code: true, name: true } },
      supplier: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDeskUser(id: string, plantIds: string[]) {
  return prisma.user.findFirst({
    where: {
      id,
      ...notDeleted,
      OR: [
        { plantAccess: { some: { plantId: { in: plantIds } } } },
        { customer: { plantId: { in: plantIds } } },
        { supplier: { plantId: { in: plantIds } } },
      ],
    },
    include: {
      userRoles: { include: { role: true } },
      customer: { select: { id: true, code: true, name: true } },
      supplier: { select: { id: true, code: true, name: true, contact: true } },
      employee: {
        select: {
          id: true,
          code: true,
          name: true,
          departmentId: true,
          shiftId: true,
          designationId: true,
          designation: true,
        },
      },
      plantAccess: { include: { plant: { select: { code: true, name: true, id: true } } } },
    },
  });
}

export async function getEmployee(id: string, plantIds: string[]) {
  return prisma.employee.findFirst({
    where: { id, plantId: { in: plantIds }, ...notDeleted },
    include: {
      shift: true,
      department: true,
      supervisor: { select: { id: true, name: true, code: true } },
      assignedMachine: { select: { id: true, name: true, code: true } },
      designationRecord: true,
      user: {
        include: {
          userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          userPermissions: { include: { permission: true } },
          plantAccess: true,
        },
      },
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

export async function listCategories(plantIds: string[]) {
  return prisma.productCategory.findMany({
    where: { plantId: { in: plantIds }, code: { in: ["TRADING", "MFG"] } },
    orderBy: { name: "asc" },
  });
}

export async function listGrades(plantIds: string[]) {
  const materials = await prisma.materialMaster.findMany({
    where: { plantId: { in: plantIds }, grade: { not: null } },
    select: { grade: true },
    distinct: ["grade"],
  });
  return materials
    .map((m) => ({ id: m.grade!, name: m.grade! }))
    .filter((g) => g.name.trim() !== "")
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listUoms(plantIds: string[]) {
  return prisma.unitOfMeasure.findMany({
    where: { plantId: { in: plantIds }, isActive: true },
    orderBy: { symbol: "asc" },
  });
}

/** Customers for sales orders, including portal (Users) accounts linked to a master record. */
export async function listSalesOrderCustomers(plantIds: string[]) {
  const rows = await prisma.customer.findMany({
    where: { plantId: { in: plantIds } },
    include: { portalUser: { select: { email: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.portalUser ? `${row.name} · portal ${row.portalUser.email}` : row.name,
  }));
}

/** Sellable stock SKUs from product masters (catalog / materials), not only utensil category. */
export async function listSalesOrderProducts(plantIds: string[]) {
  const rows = await prisma.materialMaster.findMany({
    where: { plantId: { in: plantIds }, active: true, salesAllowed: true },
    include: {
      productVariant: { include: { product: { select: { name: true, sku: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => {
    const family = row.productVariant?.product;
    const base =
      family != null
        ? { id: row.id, name: `${row.name} (${family.sku})`, uom: row.uom, categoryId: row.categoryId ?? "" }
        : { id: row.id, name: `${row.name} (${row.code})`, uom: row.uom, categoryId: row.categoryId ?? "" };
    return base;
  });
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
  const [finished, reservedSales] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { plantId: { in: plantIds }, finishedQty: { gt: 0 }, batch: { qualityStatus: "pass" } },
      include: { batch: true },
      take: 50,
    }),
    prisma.stockReservation.findMany({
      where: {
        plantId: { in: plantIds },
        status: "active",
        qty: { gt: 0 },
        batch: { qualityStatus: "pass" },
      },
      include: { batch: { include: { material: true } }, salesOrderItem: true },
      take: 50,
    }),
  ]);
  const seen = new Set<string>();
  const rows: { id: string; label: string }[] = [];
  for (const row of finished) {
    seen.add(row.batchId);
    rows.push({ id: row.batchId, label: `${row.batch.batchNo} · ${qtyText(row.finishedQty)} finished` });
  }
  for (const row of reservedSales) {
    if (row.salesOrderItem?.productId !== row.batch.materialId) continue;
    if (seen.has(row.batchId)) continue;
    seen.add(row.batchId);
    rows.push({
      id: row.batchId,
      label: `${row.batch.batchNo} · ${qtyText(row.qty)} reserved ${row.batch.material.name}`,
    });
  }
  return rows;
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
      customer: {
        include: {
          portalUser: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      items: { include: { product: true } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      requirements: { include: { material: true } },
      productionOrders: { include: { product: true } },
      jobCards: {
        orderBy: [{ productionOrderId: "asc" }, { sequence: "asc" }],
        include: {
          assignee: { include: { shift: true, department: true } },
          machine: true,
          die: true,
          productionOrder: { include: { product: true } },
          salesOrderItem: { include: { product: true } },
          predecessors: { include: { predecessor: true } },
          statusEvents: { orderBy: { createdAt: "desc" }, take: 3 },
        },
      },
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
    include: {
      productCategory: { select: { name: true, code: true } },
      productVariant: { include: { product: { select: { name: true, sku: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** All stock SKUs for desk catalog (company-wide). */
export async function listAllProductsForDesk() {
  return prisma.materialMaster.findMany({
    include: {
      productCategory: {
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
          parent: { select: { id: true, name: true, code: true, parent: { select: { code: true, name: true } } } },
        },
      },
      productVariant: { include: { product: { select: { name: true, sku: true, supplyMode: true } } } },
      plant: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMaterialMaster(id: string, plantIds?: string[]) {
  return prisma.materialMaster.findFirst({
    where: { id, ...(plantIds?.length ? { plantId: { in: plantIds } } : {}) },
    include: {
      productCategory: {
        include: { parent: { select: { id: true, name: true, code: true, parent: { select: { code: true, name: true } } } } },
      },
    },
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
