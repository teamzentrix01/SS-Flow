import { plantIdsForSession, requirePermission } from "@/lib/access";
import { csvResponse, toCsv } from "@/modules/inventory/csv";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { listStockMovements, listStockRegisterAll } from "@/modules/inventory/queries";
import { jsonError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { MOVEMENT_TYPE_LABELS } from "@/modules/inventory/constants";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("report.export");
    const plantIds = await plantIdsForSession(session);
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries()) as InventorySearchParams;
    const filters = parseInventoryFilters(params, plantIds);
    const kind = params.kind ?? "register";
    if (kind === "movements") {
      const list = await listStockMovements({ ...filters, page: 1, pageSize: 5000 });
      const csv = toCsv(
        ["When", "Type", "SKU", "Material", "Batch", "Qty", "UOM", "Source", "Destination", "Reason", "By"],
        list.rows.map((row) => [
          row.when,
          MOVEMENT_TYPE_LABELS[row.type as keyof typeof MOVEMENT_TYPE_LABELS] ?? row.type,
          row.code,
          row.material,
          row.batchNo,
          row.qty,
          row.uom,
          row.source,
          row.destination,
          row.reason ?? "",
          row.performedBy,
        ]),
      );
      return csvResponse("stock-movements.csv", csv);
    }
    if (kind !== "register") {
      throw new AppError(400, "VALIDATION", "Unknown export kind.");
    }
    const rows = await listStockRegisterAll(filters);
    const csv = toCsv(
      ["SKU", "Material", "Category", "Factory", "UOM", "Available", "Reserved", "QC hold", "Rejected", "WIP", "Finished", "Scrap", "Physical", "Status"],
      rows.map((row) => [
        row.code,
        row.name,
        row.category,
        row.plant,
        row.uom,
        row.available,
        row.reserved,
        row.qcHold,
        row.rejected,
        row.wip,
        row.finished,
        row.scrap,
        row.physical,
        row.status,
      ]),
    );
    return csvResponse("stock-register.csv", csv);
  } catch (error) {
    return jsonError(error);
  }
}
