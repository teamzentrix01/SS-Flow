import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { physicalQty } from "@/lib/domain/buckets";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { CATEGORY_DELETED_STATUS } from "@/lib/soft-delete";
import { OPEN_PO_STATUSES, OPEN_TRANSFER_STATUSES, type RegisterSort } from "@/modules/inventory/constants";
import type { InventoryFilters } from "@/modules/inventory/filters";
import {
  bucketsFromQty,
  deriveStockStatus,
  matchesStockStatus,
  milliOf,
  type StockStatus,
} from "@/modules/inventory/status";

function qty(value: bigint) {
  return fromMilli(value);
}

function emptyBuckets() {
  return {
    available: 0n,
    reserved: 0n,
    qcHold: 0n,
    wip: 0n,
    finished: 0n,
    scrap: 0n,
    rejected: 0n,
    inTransit: 0n,
  };
}

function addBuckets(
  target: ReturnType<typeof emptyBuckets>,
  add: ReturnType<typeof emptyBuckets>,
) {
  target.available += add.available;
  target.reserved += add.reserved;
  target.qcHold += add.qcHold;
  target.wip += add.wip;
  target.finished += add.finished;
  target.scrap += add.scrap;
  target.rejected += add.rejected;
  target.inTransit += add.inTransit;
}

function materialWhere(filters: InventoryFilters): Prisma.MaterialMasterWhereInput {
  const and: Prisma.MaterialMasterWhereInput[] = [];
  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { code: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.grade) {
    and.push({
      OR: [
        { grade: { contains: filters.grade, mode: "insensitive" } },
        { batches: { some: { grade: { contains: filters.grade, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters.thickness) {
    and.push({
      OR: [{ thickness: filters.thickness }, { batches: { some: { thickness: filters.thickness } } }],
    });
  }
  return {
    plantId: { in: filters.plantIds },
    ...(filters.materialId ? { id: filters.materialId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.form ? { shape: filters.form } : {}),
    ...(filters.uom ? { uom: { equals: filters.uom, mode: "insensitive" } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

function createdAtFilter(filters: InventoryFilters) {
  if (!filters.from && !filters.to) return undefined;
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

export async function inventoryFilterOptions(plantIds: string[]) {
  if (!plantIds.length) {
    return { plants: [], categories: [], materials: [], grades: [], forms: [], uoms: [] };
  }
  const [plants, categories, materials, gradeRows, batchGrades, uoms] = await Promise.all([
    prisma.plant.findMany({
      where: { id: { in: plantIds } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.productCategory.findMany({
      where: {
        status: { not: CATEGORY_DELETED_STATUS },
        OR: [{ plantId: { in: plantIds } }, { products: { some: { plantId: { in: plantIds } } } }],
      },
      select: { id: true, name: true, code: true, status: true, productForm: true },
      orderBy: { name: "asc" },
    }),
    prisma.materialMaster.findMany({
      where: { plantId: { in: plantIds }, active: true },
      select: { id: true, name: true, code: true, plantId: true, shape: true, uom: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      take: 500,
    }),
    prisma.materialMaster.findMany({
      where: { plantId: { in: plantIds }, grade: { not: null } },
      select: { grade: true },
      distinct: ["grade"],
    }),
    prisma.materialBatch.findMany({
      where: { plantId: { in: plantIds }, grade: { not: null } },
      select: { grade: true },
      distinct: ["grade"],
    }),
    prisma.materialMaster.findMany({
      where: { plantId: { in: plantIds } },
      select: { uom: true },
      distinct: ["uom"],
    }),
  ]);
  const grades = [...new Set([...gradeRows, ...batchGrades].map((row) => row.grade).filter((value): value is string => Boolean(value)))].sort();
  const forms = [...new Set(materials.map((row) => row.shape).filter(Boolean))].sort();
  return {
    plants,
    categories,
    materials,
    grades,
    forms,
    uoms: [...new Set(uoms.map((row) => row.uom.toUpperCase()))].sort(),
  };
}

type AggregatedSku = {
  materialId: string;
  plantId: string;
  code: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  categoryType: string | null;
  productForm: string;
  grade: string;
  thickness: string | null;
  width: string | null;
  length: string | null;
  diameter: string | null;
  requiredSpecs: string[];
  plantName: string;
  uom: string;
  purchaseAllowed: boolean;
  manufacturingAllowed: boolean;
  reorderLevel: bigint | null;
  minStockLevel: bigint | null;
  buckets: ReturnType<typeof emptyBuckets>;
  updatedAt: Date | null;
  lastMovementAt: Date | null;
  status: StockStatus;
  locations: string[];
};

function sortAggregated(rows: AggregatedSku[], sort: RegisterSort, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1;
  const qtyKey = {
    available: "available",
    reserved: "reserved",
    qcHold: "qcHold",
    rejected: "rejected",
    wip: "wip",
    finished: "finished",
    scrap: "scrap",
  } as const;
  rows.sort((a, b) => {
    let cmp = 0;
    if (sort === "code") cmp = a.code.localeCompare(b.code);
    else if (sort === "name") cmp = a.name.localeCompare(b.name);
    else if (sort === "category") cmp = a.categoryName.localeCompare(b.categoryName);
    else if (sort === "plant") cmp = a.plantName.localeCompare(b.plantName);
    else if (sort === "updatedAt") {
      const left = (a.lastMovementAt ?? a.updatedAt)?.getTime() ?? 0;
      const right = (b.lastMovementAt ?? b.updatedAt)?.getTime() ?? 0;
      cmp = left - right;
    }
    else if (sort === "physical") cmp = physicalQty(a.buckets) > physicalQty(b.buckets) ? 1 : physicalQty(a.buckets) < physicalQty(b.buckets) ? -1 : 0;
    else {
      const key = qtyKey[sort as keyof typeof qtyKey];
      if (key) {
        cmp = a.buckets[key] > b.buckets[key] ? 1 : a.buckets[key] < b.buckets[key] ? -1 : 0;
      } else {
        cmp = a.name.localeCompare(b.name);
      }
    }
    return cmp * sign;
  });
}

async function aggregateStock(filters: InventoryFilters) {
  if (!filters.plantIds.length) return [] as AggregatedSku[];
  const materials = await prisma.materialMaster.findMany({
    where: materialWhere(filters),
    include: {
      productCategory: { select: { id: true, name: true, categoryType: true, productForm: true, requiredSpecs: true } },
      plant: { select: { id: true, name: true } },
    },
  });
  if (!materials.length) return [];
  const materialIds = materials.map((row) => row.id);
  const [balances, lastMoves] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { plantId: { in: filters.plantIds }, batch: { materialId: { in: materialIds } } },
      select: {
        plantId: true,
        availableQty: true,
        reservedQty: true,
        qcHoldQty: true,
        wipQty: true,
        finishedQty: true,
        scrapQty: true,
        rejectedQty: true,
        inTransitQty: true,
        updatedAt: true,
        uom: true,
        location: { select: { code: true, warehouse: { select: { code: true } } } },
        batch: { select: { materialId: true } },
      },
    }),
    prisma.stockLedger.groupBy({
      by: ["batchId"],
      where: { plantId: { in: filters.plantIds }, batch: { materialId: { in: materialIds } } },
      _max: { createdAt: true },
    }),
  ]);

  const lastByMaterial = new Map<string, Date>();
  if (lastMoves.length) {
    const batchRows = await prisma.materialBatch.findMany({
      where: { id: { in: lastMoves.map((row) => row.batchId) } },
      select: { id: true, materialId: true },
    });
    const materialByBatch = new Map(batchRows.map((row) => [row.id, row.materialId]));
    for (const row of lastMoves) {
      const materialId = materialByBatch.get(row.batchId);
      const at = row._max.createdAt;
      if (!materialId || !at) continue;
      const current = lastByMaterial.get(materialId);
      if (!current || at > current) lastByMaterial.set(materialId, at);
    }
  }

  const byMaterial = new Map<string, AggregatedSku>();
  for (const material of materials) {
    byMaterial.set(material.id, {
      materialId: material.id,
      plantId: material.plantId,
      code: material.code,
      name: material.name,
      categoryId: material.categoryId,
      categoryName: material.productCategory?.name ?? material.category,
      categoryType: material.productCategory?.categoryType ?? null,
      productForm: material.productCategory?.productForm ?? material.shape,
      grade: material.grade ?? "—",
      thickness: material.thickness?.toString() ?? null,
      width: material.width?.toString() ?? null,
      length: material.length?.toString() ?? null,
      diameter: material.diameter?.toString() ?? null,
      requiredSpecs: material.productCategory?.requiredSpecs ?? [],
      plantName: material.plant.name,
      uom: material.uom,
      purchaseAllowed: material.purchaseAllowed,
      manufacturingAllowed: material.manufacturingAllowed,
      reorderLevel: material.reorderLevel != null ? milliOf(material.reorderLevel) : null,
      minStockLevel: material.minStockLevel != null ? milliOf(material.minStockLevel) : null,
      buckets: emptyBuckets(),
      updatedAt: null,
      lastMovementAt: lastByMaterial.get(material.id) ?? null,
      status: "out_of_stock",
      locations: [],
    });
  }

  for (const row of balances) {
    const item = byMaterial.get(row.batch.materialId);
    if (!item) continue;
    addBuckets(item.buckets, bucketsFromQty(row));
    if (!item.updatedAt || row.updatedAt > item.updatedAt) item.updatedAt = row.updatedAt;
    const location = `${row.location.warehouse.code} / ${row.location.code}`;
    if (!item.locations.includes(location)) item.locations.push(location);
  }

  const minAvailable = filters.minAvailable ? toMilli(filters.minAvailable) : null;
  const maxAvailable = filters.maxAvailable ? toMilli(filters.maxAvailable) : null;
  const rows: AggregatedSku[] = [];
  for (const item of byMaterial.values()) {
    item.status = deriveStockStatus(item.buckets, item.reorderLevel);
    if (!matchesStockStatus(filters.status, item.buckets, item.reorderLevel)) continue;
    if (minAvailable != null && item.buckets.available < minAvailable) continue;
    if (maxAvailable != null && item.buckets.available > maxAvailable) continue;
    rows.push(item);
  }
  sortAggregated(rows, filters.sort, filters.dir);
  return rows;
}

export function serializeRegisterRow(row: AggregatedSku) {
  const physical = physicalQty(row.buckets);
  return {
    materialId: row.materialId,
    plantId: row.plantId,
    code: row.code,
    name: row.name,
    category: row.categoryName,
    categoryType: row.categoryType,
    productForm: row.productForm,
    grade: row.grade,
    thickness: row.thickness,
    width: row.width,
    length: row.length,
    diameter: row.diameter,
    requiredSpecs: row.requiredSpecs,
    plant: row.plantName,
    location: row.locations[0] ?? "—",
    locations: row.locations,
    uom: row.uom,
    available: qty(row.buckets.available),
    reserved: qty(row.buckets.reserved),
    qcHold: qty(row.buckets.qcHold),
    rejected: qty(row.buckets.rejected),
    wip: qty(row.buckets.wip),
    finished: qty(row.buckets.finished),
    scrap: qty(row.buckets.scrap),
    inTransit: qty(row.buckets.inTransit),
    physical: qty(physical),
    atp: qty(row.buckets.available),
    reorderLevel: row.reorderLevel != null ? qty(row.reorderLevel) : null,
    minStockLevel: row.minStockLevel != null ? qty(row.minStockLevel) : null,
    lastMovementAt: row.lastMovementAt?.toISOString() ?? row.updatedAt?.toISOString() ?? null,
    status: row.status,
    purchaseAllowed: row.purchaseAllowed,
    manufacturingAllowed: row.manufacturingAllowed,
  };
}

export async function listStockRegister(filters: InventoryFilters) {
  const rows = await aggregateStock(filters);
  const total = rows.length;
  const start = (filters.page - 1) * filters.pageSize;
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rows: rows.slice(start, start + filters.pageSize).map(serializeRegisterRow),
  };
}

export async function listStockRegisterAll(filters: InventoryFilters) {
  const rows = await aggregateStock({ ...filters, page: 1, pageSize: 10_000 });
  return rows.map(serializeRegisterRow);
}

export async function inventoryOverview(filters: InventoryFilters) {
  const [register, skuCount, pendingQc, openTransfers, pendingInspections] = await Promise.all([
    aggregateStock({ ...filters, status: undefined, minAvailable: undefined, maxAvailable: undefined, page: 1, pageSize: 10_000, sort: "name", dir: "asc" }),
    prisma.materialMaster.count({ where: { ...materialWhere(filters), active: true } }),
    prisma.qcInspection.count({
      where: {
        plantId: { in: filters.plantIds },
        status: "pending",
        kind: "incoming",
        ...(filters.materialId || filters.categoryId || filters.q
          ? { batch: { material: materialWhere(filters) } }
          : {}),
      },
    }),
    prisma.stockTransfer.count({
      where: {
        status: { in: [...OPEN_TRANSFER_STATUSES] },
        OR: [{ sourcePlantId: { in: filters.plantIds } }, { destinationPlantId: { in: filters.plantIds } }],
      },
    }),
    prisma.qcInspection.count({
      where: { plantId: { in: filters.plantIds }, status: "pending" },
    }),
  ]);

  const totals = emptyBuckets();
  const byCategory = new Map<string, bigint>();
  const byPlant = new Map<string, { name: string; qty: bigint }>();
  let lowStock = 0;
  let outOfStock = 0;
  const lowStockRows: AggregatedSku[] = [];
  for (const row of register) {
    addBuckets(totals, row.buckets);
    const physical = physicalQty(row.buckets);
    byCategory.set(row.categoryName, (byCategory.get(row.categoryName) ?? 0n) + physical);
    const plant = byPlant.get(row.plantId) ?? { name: row.plantName, qty: 0n };
    plant.qty += physical;
    byPlant.set(row.plantId, plant);
    if (row.status === "low_stock") {
      lowStock += 1;
      lowStockRows.push(row);
    }
    if (row.status === "out_of_stock") outOfStock += 1;
  }

  const outstandingWhere: Prisma.PurchaseOrderItemWhereInput = {
    order: { plantId: { in: filters.plantIds }, status: { in: [...OPEN_PO_STATUSES] } },
    ...(filters.materialId ? { materialId: filters.materialId } : {}),
    ...(filters.categoryId ? { material: { categoryId: filters.categoryId } } : {}),
  };
  const poItems = await prisma.purchaseOrderItem.findMany({
    where: outstandingWhere,
    select: { qty: true, receivedQty: true },
  });
  let outstanding = 0n;
  for (const item of poItems) {
    const left = milliOf(item.qty) - milliOf(item.receivedQty);
    if (left > 0n) outstanding += left;
  }

  const movementFrom = filters.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const movementTo = filters.to ?? new Date();
  const movements = await prisma.stockLedger.findMany({
    where: {
      plantId: { in: filters.plantIds },
      createdAt: { gte: movementFrom, lte: movementTo },
      ...(filters.materialId || filters.categoryId || filters.q ? { batch: { material: materialWhere(filters) } } : {}),
    },
    select: { createdAt: true, qty: true, movementType: true, batch: { select: { materialId: true, material: { select: { name: true, code: true } } } } },
    take: 8000,
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, bigint>();
  const byMaterialQty = new Map<string, { name: string; code: string; qty: bigint }>();
  for (const row of movements) {
    const day = row.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0n) + milliOf(row.qty));
    const current = byMaterialQty.get(row.batch.materialId) ?? {
      name: row.batch.material.name,
      code: row.batch.material.code,
      qty: 0n,
    };
    current.qty += milliOf(row.qty);
    byMaterialQty.set(row.batch.materialId, current);
  }

  const moving = [...byMaterialQty.values()].sort((a, b) => (a.qty > b.qty ? -1 : 1));
  const stocked = register.filter((row) => physicalQty(row.buckets) > 0n);
  const slow = stocked
    .filter((row) => !byMaterialQty.has(row.materialId))
    .slice(0, 8)
    .map((row) => ({ name: row.name, code: row.code, qty: qty(physicalQty(row.buckets)) }));

  return {
    skuCount,
    totals: {
      available: qty(totals.available),
      reserved: qty(totals.reserved),
      qcHold: qty(totals.qcHold),
      rejected: qty(totals.rejected),
      wip: qty(totals.wip),
      finished: qty(totals.finished),
      scrap: qty(totals.scrap),
      inTransit: qty(totals.inTransit),
      physical: qty(physicalQty(totals)),
    },
    lowStock,
    outOfStock,
    pendingQc,
    pendingInspections,
    outstandingPoQty: qty(outstanding),
    openTransfers,
    byCategory: [...byCategory.entries()]
      .map(([label, value]) => ({ label, value: qty(value) }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 8),
    byBucket: [
      { label: "Available", value: qty(totals.available) },
      { label: "Reserved", value: qty(totals.reserved) },
      { label: "QC hold", value: qty(totals.qcHold) },
      { label: "Rejected", value: qty(totals.rejected) },
      { label: "WIP", value: qty(totals.wip) },
      { label: "Finished", value: qty(totals.finished) },
      { label: "Scrap", value: qty(totals.scrap) },
      { label: "In transit", value: qty(totals.inTransit) },
    ],
    byPlant: [...byPlant.values()].map((row) => ({ label: row.name, value: qty(row.qty) })),
    movementTrend: [...byDay.entries()].map(([label, value]) => ({ label, value: qty(value) })),
    lowStockItems: lowStockRows.slice(0, 8).map(serializeRegisterRow),
    fastMoving: moving.slice(0, 8).map((row) => ({ ...row, qty: qty(row.qty) })),
    slowMoving: slow,
    movementCount: movements.length,
  };
}

export async function listFactoryStock(filters: InventoryFilters) {
  const rows = await aggregateStock({ ...filters, page: 1, pageSize: 10_000, sort: "plant", dir: "asc" });
  const plants = await prisma.plant.findMany({
    where: { id: { in: filters.plantIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return plants.map((plant) => {
    const items = rows.filter((row) => row.plantId === plant.id);
    const totals = emptyBuckets();
    for (const item of items) addBuckets(totals, item.buckets);
    return {
      id: plant.id,
      name: plant.name,
      code: plant.code,
      totals: {
        available: qty(totals.available),
        reserved: qty(totals.reserved),
        qcHold: qty(totals.qcHold),
        rejected: qty(totals.rejected),
        wip: qty(totals.wip),
        finished: qty(totals.finished),
        scrap: qty(totals.scrap),
        inTransit: qty(totals.inTransit),
        physical: qty(physicalQty(totals)),
      },
      skuCount: items.length,
      lowStock: items.filter((row) => row.status === "low_stock").length,
      rows: items.slice(0, 25).map(serializeRegisterRow),
    };
  });
}

export async function listMaterialBatches(filters: InventoryFilters) {
  if (!filters.plantIds.length) return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  const and: Prisma.MaterialBatchWhereInput[] = [];
  if (filters.categoryId || filters.form || filters.uom) {
    and.push({ material: materialWhere({ ...filters, q: undefined, grade: undefined }) });
  }
  if (filters.materialId) and.push({ materialId: filters.materialId });
  if (filters.grade) {
    and.push({
      OR: [
        { grade: { contains: filters.grade, mode: "insensitive" } },
        { material: { grade: { contains: filters.grade, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.q) {
    and.push({
      OR: [
        { batchNo: { contains: filters.q, mode: "insensitive" } },
        { heatNo: { contains: filters.q, mode: "insensitive" } },
        { supplierBatchNo: { contains: filters.q, mode: "insensitive" } },
        { material: { name: { contains: filters.q, mode: "insensitive" } } },
        { material: { code: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.MaterialBatchWhereInput = {
    plantId: { in: filters.plantIds },
    ...(and.length ? { AND: and } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.materialBatch.count({ where }),
    prisma.materialBatch.findMany({
      where,
      include: {
        material: { include: { productCategory: { select: { name: true, productForm: true, requiredSpecs: true } } } },
        plant: { select: { name: true, code: true } },
        location: { include: { warehouse: true } },
        balances: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rows: rows.map((batch) => {
      const buckets = emptyBuckets();
      for (const balance of batch.balances) addBuckets(buckets, bucketsFromQty(balance));
      return {
        id: batch.id,
        batchNo: batch.batchNo,
        supplierBatchNo: batch.supplierBatchNo,
        heatNo: batch.heatNo,
        quality: batch.qualityStatus,
        materialId: batch.materialId,
        material: batch.material.name,
        code: batch.material.code,
        category: batch.material.productCategory?.name ?? batch.material.category,
        plant: batch.plant.name,
        location: batch.location ? `${batch.location.warehouse.code} / ${batch.location.code}` : "—",
        grade: batch.grade ?? batch.material.grade,
        thickness: batch.thickness?.toString() ?? batch.material.thickness?.toString() ?? null,
        uom: batch.receivedUom ?? batch.material.uom,
        available: qty(buckets.available),
        reserved: qty(buckets.reserved),
        qcHold: qty(buckets.qcHold),
        rejected: qty(buckets.rejected),
        physical: qty(physicalQty(buckets)),
        createdAt: batch.createdAt.toISOString(),
      };
    }),
  };
}

export async function listStockMovements(filters: InventoryFilters) {
  if (!filters.plantIds.length) return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  const createdAt = createdAtFilter(filters);
  const where: Prisma.StockLedgerWhereInput = {
    plantId: { in: filters.plantIds },
    ...(filters.movementType ? { movementType: filters.movementType } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(filters.reference
      ? {
          OR: [
            { reason: { contains: filters.reference, mode: "insensitive" } },
            { referenceId: filters.reference },
          ],
        }
      : {}),
    ...(filters.materialId || filters.categoryId || filters.q || filters.grade || filters.form
      ? {
          batch: {
            ...(filters.materialId ? { materialId: filters.materialId } : {}),
            ...(filters.q
              ? {
                  OR: [
                    { batchNo: { contains: filters.q, mode: "insensitive" } },
                    { heatNo: { contains: filters.q, mode: "insensitive" } },
                    { material: { name: { contains: filters.q, mode: "insensitive" } } },
                    { material: { code: { contains: filters.q, mode: "insensitive" } } },
                  ],
                }
              : {}),
            material: filters.categoryId || filters.form || filters.uom ? materialWhere(filters) : undefined,
          },
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.stockLedger.count({ where }),
    prisma.stockLedger.findMany({
      where,
      include: {
        batch: {
          select: {
            id: true,
            batchNo: true,
            heatNo: true,
            material: { select: { id: true, name: true, code: true, uom: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  const userIds = [...new Set(rows.map((row) => row.performedBy))];
  const locationIds = [...new Set(rows.flatMap((row) => [row.locationId, row.destLocationId].filter((id): id is string => Boolean(id))))];
  const [users, locations] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    locationIds.length
      ? prisma.storageLocation.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, code: true, warehouse: { select: { code: true, plant: { select: { name: true } } } } },
        })
      : [],
  ]);
  const userName = new Map(users.map((row) => [row.id, row.name]));
  const locationLabel = new Map(
    locations.map((row) => [row.id, `${row.warehouse.plant.name} · ${row.warehouse.code} / ${row.code}`]),
  );
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rows: rows.map((row) => ({
      id: row.id,
      when: row.createdAt.toISOString(),
      type: row.movementType,
      qty: qty(milliOf(row.qty)),
      uom: row.uom,
      reason: row.reason,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      batchId: row.batchId,
      batchNo: row.batch.batchNo,
      heatNo: row.batch.heatNo,
      materialId: row.batch.material.id,
      material: row.batch.material.name,
      code: row.batch.material.code,
      source: locationLabel.get(row.locationId) ?? "—",
      destination: row.destLocationId ? locationLabel.get(row.destLocationId) ?? "—" : "—",
      performedBy: userName.get(row.performedBy) ?? "—",
    })),
  };
}

export async function stockMovementDetail(id: string, plantIds: string[]) {
  const row = await prisma.stockLedger.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      batch: {
        include: {
          material: { include: { productCategory: { select: { name: true } } } },
          plant: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;
  const [user, location, dest] = await Promise.all([
    prisma.user.findUnique({ where: { id: row.performedBy }, select: { name: true } }),
    prisma.storageLocation.findUnique({
      where: { id: row.locationId },
      select: { code: true, warehouse: { select: { code: true, plant: { select: { name: true } } } } },
    }),
    row.destLocationId
      ? prisma.storageLocation.findUnique({
          where: { id: row.destLocationId },
          select: { code: true, warehouse: { select: { code: true, plant: { select: { name: true } } } } },
        })
      : null,
  ]);
  return {
    id: row.id,
    when: row.createdAt.toISOString(),
    type: row.movementType,
    qty: qty(milliOf(row.qty)),
    uom: row.uom,
    reason: row.reason,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceLineId: row.referenceLineId,
    batchId: row.batchId,
    batchNo: row.batch.batchNo,
    heatNo: row.batch.heatNo,
    material: row.batch.material.name,
    code: row.batch.material.code,
    category: row.batch.material.productCategory?.name ?? row.batch.material.category,
    plant: row.batch.plant.name,
    source: location ? `${location.warehouse.plant.name} · ${location.warehouse.code} / ${location.code}` : "—",
    destination: dest ? `${dest.warehouse.plant.name} · ${dest.warehouse.code} / ${dest.code}` : "—",
    performedBy: user?.name ?? "—",
  };
}

export async function listInventoryQc(filters: InventoryFilters) {
  if (!filters.plantIds.length) return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  const where: Prisma.QcInspectionWhereInput = {
    plantId: { in: filters.plantIds },
    ...(filters.rawStatus && ["pending", "pass", "hold", "fail", "rework"].includes(filters.rawStatus)
      ? { status: filters.rawStatus }
      : filters.status === "qc_hold"
        ? { status: "pending" }
        : {}),
    kind: "incoming",
    ...(filters.materialId || filters.categoryId || filters.q
      ? { batch: { material: materialWhere({ ...filters, status: undefined }) } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.qcInspection.count({ where }),
    prisma.qcInspection.findMany({
      where,
      include: {
        batch: {
          include: {
            material: { include: { productCategory: { select: { name: true } } } },
            plant: { select: { name: true } },
            receiptItems: {
              include: {
                receipt: { include: { order: { include: { supplier: true, plant: true } }, plant: true, intendedPlant: true } },
                orderItem: true,
              },
              take: 1,
            },
            balances: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rows: rows.map((row) => {
      const source = row.batch?.receiptItems[0];
      const buckets = emptyBuckets();
      for (const balance of row.batch?.balances ?? []) addBuckets(buckets, bucketsFromQty(balance));
      return {
        id: row.id,
        status: row.status,
        kind: row.kind,
        when: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        remarks: row.remarks,
        batchId: row.batchId,
        batchNo: row.batch?.batchNo ?? "—",
        heatNo: row.batch?.heatNo,
        grade: row.batch?.grade,
        material: row.batch?.material.name ?? "—",
        code: row.batch?.material.code ?? "—",
        plant: row.batch?.plant.name ?? "—",
        supplier: source?.receipt.order.supplier.name ?? "—",
        po: source?.receipt.order.number ?? "—",
        poId: source?.receipt.orderId ?? null,
        grn: source?.receipt.number ?? "—",
        grnId: source?.receiptId ?? null,
        intendedPlant: source?.receipt.intendedPlant?.name ?? source?.receipt.order.plant.name ?? "—",
        receivingPlant: source?.receipt.plant.name ?? "—",
        delivered: source ? qty(milliOf(source.deliveredQty)) : "—",
        accepted: source ? qty(milliOf(source.acceptedQty)) : "—",
        rejected: source ? qty(milliOf(source.rejectedQty)) : "—",
        qcHold: qty(buckets.qcHold),
        rejectionReason: source?.rejectionReason ?? row.remarks,
      };
    }),
  };
}

export async function listReservations(filters: InventoryFilters) {
  if (!filters.plantIds.length) return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  const where: Prisma.StockReservationWhereInput = {
    plantId: { in: filters.plantIds },
    ...(filters.rawStatus && ["active", "issued"].includes(filters.rawStatus) ? { status: filters.rawStatus } : {}),
    ...(filters.materialId || filters.categoryId || filters.q
      ? { batch: { material: materialWhere({ ...filters, status: undefined }) } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.stockReservation.count({ where }),
    prisma.stockReservation.findMany({
      where,
      include: {
        batch: { include: { material: true } },
        plant: { select: { name: true } },
        salesOrderItem: { include: { order: { select: { id: true, number: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  const locationIds = [...new Set(rows.map((row) => row.locationId))];
  const locations = locationIds.length
    ? await prisma.storageLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, code: true, warehouse: { select: { code: true } } },
      })
    : [];
  const locationLabel = new Map(locations.map((row) => [row.id, `${row.warehouse.code} / ${row.code}`]));
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rows: rows.map((row) => ({
      id: row.id,
      status: row.status,
      qty: qty(milliOf(row.qty)),
      uom: row.uom,
      when: row.createdAt.toISOString(),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      batchId: row.batchId,
      batchNo: row.batch.batchNo,
      material: row.batch.material.name,
      code: row.batch.material.code,
      plant: row.plant.name,
      location: locationLabel.get(row.locationId) ?? "—",
      salesOrder: row.salesOrderItem?.order.number ?? null,
      salesOrderId: row.salesOrderItem?.order.id ?? null,
    })),
  };
}

export async function listInterFactoryTransfers(filters: InventoryFilters) {
  if (!filters.plantIds.length) return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  const where: Prisma.StockTransferWhereInput = {
    OR: [{ sourcePlantId: { in: filters.plantIds } }, { destinationPlantId: { in: filters.plantIds } }],
    ...(filters.rawStatus && ["draft", "approved", "in_transit", "received", "cancelled"].includes(filters.rawStatus)
      ? { status: filters.rawStatus }
      : {}),
    ...(filters.materialId ? { batch: { materialId: filters.materialId } } : {}),
    ...(filters.q
      ? {
          OR: [
            { notes: { contains: filters.q, mode: "insensitive" } },
            { batch: { batchNo: { contains: filters.q, mode: "insensitive" } } },
            { batch: { material: { name: { contains: filters.q, mode: "insensitive" } } } },
            { batch: { material: { code: { contains: filters.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.stockTransfer.count({ where }),
    prisma.stockTransfer.findMany({
      where,
      include: {
        sourcePlant: { select: { name: true, code: true } },
        destinationPlant: { select: { name: true, code: true } },
        batch: { include: { material: true } },
        sourceLocation: { include: { warehouse: true } },
        destLocation: { include: { warehouse: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    rows: rows.map((row) => ({
      id: row.id,
      status: row.status,
      sourcePlant: row.sourcePlant.name,
      destPlant: row.destinationPlant.name,
      material: row.batch.material.name,
      code: row.batch.material.code,
      batchNo: row.batch.batchNo,
      heatNo: row.batch.heatNo,
      requested: qty(milliOf(row.requestedQty)),
      dispatched: qty(milliOf(row.dispatchedQty)),
      received: qty(milliOf(row.receivedQty)),
      rejected: qty(milliOf(row.rejectedQty)),
      uom: row.uom,
      notes: row.notes,
      when: row.createdAt.toISOString(),
    })),
  };
}

export async function interFactoryTransferDetail(id: string, plantIds: string[]) {
  return prisma.stockTransfer.findFirst({
    where: {
      id,
      OR: [{ sourcePlantId: { in: plantIds } }, { destinationPlantId: { in: plantIds } }],
    },
    include: {
      sourcePlant: true,
      destinationPlant: true,
      batch: { include: { material: true } },
      sourceLocation: { include: { warehouse: true } },
      destLocation: { include: { warehouse: true } },
    },
  });
}

export async function listAdjustments(filters: InventoryFilters) {
  return listStockMovements({ ...filters, movementType: "adjust" });
}

export async function listReorderAlerts(filters: InventoryFilters) {
  const rows = await aggregateStock({ ...filters, page: 1, pageSize: 10_000, sort: "available", dir: "asc" });
  const poItems = await prisma.purchaseOrderItem.findMany({
    where: {
      order: { plantId: { in: filters.plantIds }, status: { in: [...OPEN_PO_STATUSES] } },
      materialId: { in: rows.map((row) => row.materialId) },
    },
    select: { materialId: true, qty: true, receivedQty: true, order: { select: { plantId: true } } },
  });
  const incoming = new Map<string, bigint>();
  for (const item of poItems) {
    const left = milliOf(item.qty) - milliOf(item.receivedQty);
    if (left > 0n) incoming.set(item.materialId, (incoming.get(item.materialId) ?? 0n) + left);
  }
  const alerts = rows
    .map((row) => {
      const incomingQty = incoming.get(row.materialId) ?? 0n;
      const reorder = row.reorderLevel ?? row.minStockLevel;
      const shortage = reorder != null && row.buckets.available < reorder ? reorder - row.buckets.available : 0n;
      const suggested = shortage > incomingQty ? shortage - incomingQty : 0n;
      return {
        ...serializeRegisterRow(row),
        incoming: qty(incomingQty),
        shortage: qty(shortage),
        suggested: qty(suggested),
        severity: row.status === "out_of_stock" ? "critical" : row.status === "low_stock" ? "warning" : shortage > 0n ? "warning" : "ok",
      };
    })
    .filter((row) => row.severity !== "ok" || filters.status);
  const start = (filters.page - 1) * filters.pageSize;
  return { total: alerts.length, page: filters.page, pageSize: filters.pageSize, rows: alerts.slice(start, start + filters.pageSize) };
}

export async function materialInventoryDetail(id: string, plantIds: string[]) {
  const material = await prisma.materialMaster.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      productCategory: true,
      plant: true,
    },
  });
  if (!material) return null;
  const [batches, movements, reservations, poItems, inspections, audits] = await Promise.all([
    prisma.materialBatch.findMany({
      where: { materialId: id, plantId: { in: plantIds } },
      include: { balances: { include: { location: { include: { warehouse: true } } } }, receiptItems: { include: { receipt: { include: { order: { include: { supplier: true } } } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.stockLedger.findMany({
      where: { plantId: { in: plantIds }, batch: { materialId: id } },
      include: { batch: { select: { batchNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.stockReservation.findMany({
      where: { plantId: { in: plantIds }, batch: { materialId: id } },
      include: { batch: { select: { batchNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.purchaseOrderItem.findMany({
      where: { materialId: id, order: { plantId: { in: plantIds } } },
      include: { order: { include: { supplier: true } }, receiptItems: { include: { receipt: true, batch: { select: { id: true, batchNo: true } } } } },
      orderBy: { order: { createdAt: "desc" } },
      take: 30,
    }),
    prisma.qcInspection.findMany({
      where: { plantId: { in: plantIds }, batch: { materialId: id } },
      include: { batch: { select: { batchNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.auditEvent.findMany({
      where: { resourceId: { in: [id] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const totals = emptyBuckets();
  for (const batch of batches) {
    for (const balance of batch.balances) addBuckets(totals, bucketsFromQty(balance));
  }
  return {
    material,
    totals: {
      available: qty(totals.available),
      reserved: qty(totals.reserved),
      qcHold: qty(totals.qcHold),
      rejected: qty(totals.rejected),
      wip: qty(totals.wip),
      finished: qty(totals.finished),
      scrap: qty(totals.scrap),
      inTransit: qty(totals.inTransit),
      physical: qty(physicalQty(totals)),
    },
    batches,
    movements,
    reservations,
    poItems,
    inspections,
    audits,
  };
}

export async function transferableBatches(plantIds: string[]) {
  const rows = await prisma.stockBalance.findMany({
    where: { plantId: { in: plantIds }, availableQty: { gt: 0 } },
    include: {
      batch: { include: { material: true, plant: { select: { name: true } } } },
      location: { include: { warehouse: { include: { plant: { select: { id: true, name: true } } } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map((row) => ({
    batchId: row.batchId,
    locationId: row.locationId,
    plantId: row.plantId,
    label: `${row.batch.batchNo} · ${row.batch.material.name} · ${qty(milliOf(row.availableQty))} ${row.uom}`,
    available: qty(milliOf(row.availableQty)),
    uom: row.uom,
    plantName: row.batch.plant.name,
  }));
}

export async function locationsByPlant(plantIds: string[]) {
  const rows = await prisma.storageLocation.findMany({
    where: { warehouse: { plantId: { in: plantIds } } },
    include: { warehouse: { include: { plant: { select: { id: true, name: true, code: true } } } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    plantId: row.warehouse.plantId,
    label: `${row.warehouse.plant.code} · ${row.warehouse.code} / ${row.code}`,
  }));
}
