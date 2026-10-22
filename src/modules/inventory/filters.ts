import { STOCK_STATUSES, type StockStatus } from "@/modules/inventory/status";
import { MOVEMENT_TYPES, REGISTER_SORTS, type RegisterSort } from "@/modules/inventory/constants";
import type { MovementType } from "@/lib/domain/buckets";

export type InventorySearchParams = {
  q?: string;
  plant?: string;
  category?: string;
  material?: string;
  grade?: string;
  form?: string;
  uom?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  minAvailable?: string;
  maxAvailable?: string;
  thickness?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
  tab?: string;
  ref?: string;
  kind?: string;
};

export type InventoryFilters = {
  plantIds: string[];
  plantId?: string;
  q?: string;
  categoryId?: string;
  materialId?: string;
  grade?: string;
  form?: string;
  uom?: string;
  status?: StockStatus;
  rawStatus?: string;
  movementType?: MovementType;
  from?: Date;
  to?: Date;
  minAvailable?: string;
  maxAvailable?: string;
  thickness?: string;
  page: number;
  pageSize: number;
  sort: RegisterSort;
  dir: "asc" | "desc";
  reference?: string;
};

const PAGE_SIZES = [25, 50, 100];

function trim(value?: string) {
  const next = value?.trim();
  return next ? next : undefined;
}

function parseDateStart(value?: string) {
  const raw = trim(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string) {
  const raw = trim(value);
  if (!raw) return undefined;
  const date = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseInventoryFilters(params: InventorySearchParams, allowedPlantIds: string[]): InventoryFilters {
  const requestedPlant = trim(params.plant);
  const plantIds =
    requestedPlant && allowedPlantIds.includes(requestedPlant) ? [requestedPlant] : allowedPlantIds;
  const status = trim(params.status);
  const movementType = trim(params.type);
  const sort = REGISTER_SORTS.includes(params.sort as RegisterSort) ? (params.sort as RegisterSort) : "name";
  const dir = params.dir === "desc" ? "desc" : params.dir === "asc" ? "asc" : sort === "name" || sort === "code" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const requestedSize = Number.parseInt(params.pageSize ?? "25", 10);
  const pageSize = PAGE_SIZES.includes(requestedSize) ? requestedSize : 25;
  return {
    plantIds,
    plantId: requestedPlant && allowedPlantIds.includes(requestedPlant) ? requestedPlant : undefined,
    q: trim(params.q),
    categoryId: trim(params.category),
    materialId: trim(params.material),
    grade: trim(params.grade),
    form: trim(params.form),
    uom: trim(params.uom)?.toUpperCase(),
    status: STOCK_STATUSES.includes(status as StockStatus) ? (status as StockStatus) : undefined,
    rawStatus: status,
    movementType: MOVEMENT_TYPES.includes(movementType as MovementType) ? (movementType as MovementType) : undefined,
    from: parseDateStart(params.from),
    to: parseDateEnd(params.to),
    minAvailable: trim(params.minAvailable),
    maxAvailable: trim(params.maxAvailable),
    thickness: trim(params.thickness),
    page,
    pageSize,
    sort,
    dir,
    reference: trim(params.ref),
  };
}

export function inventoryQueryString(
  values: Record<string, string | number | undefined | null>,
  omit: string[] = [],
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (omit.includes(key) || value == null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function inventoryHref(path: string, values: Record<string, string | number | undefined | null>) {
  return `${path}${inventoryQueryString(values)}`;
}

export function activeFilterEntries(params: InventorySearchParams) {
  const labels: Record<string, string> = {
    q: "Search",
    plant: "Factory",
    category: "Category",
    material: "Material",
    grade: "Grade",
    form: "Form",
    uom: "UOM",
    status: "Status",
    type: "Movement",
    from: "From",
    to: "To",
    minAvailable: "Min available",
    maxAvailable: "Max available",
    thickness: "Thickness",
    ref: "Reference",
  };
  return Object.entries(params)
    .filter(([key, value]) => labels[key] && value?.trim())
    .map(([key, value]) => ({ key, label: labels[key]!, value: value!.trim() }));
}
