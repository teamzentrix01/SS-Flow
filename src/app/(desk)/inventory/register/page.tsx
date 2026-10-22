import { Suspense } from "react";
import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { SortHeader } from "@/components/inventory/sort-header";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listStockRegister } from "@/modules/inventory/queries";

export default async function StockRegisterPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options] = await Promise.all([listStockRegister(filters), inventoryFilterOptions(plantIds)]);
  const canExport = session.permissions.has("report.export");
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  exportQuery.set("kind", "register");

  return (
    <DeskListShell
      title="Stock register"
      detail="One row per material and factory. Available-to-promise is the available bucket. Physical stock is the sum of every posted bucket without double-counting stages."
      action={
        canExport ? (
          <a
            className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold hover:border-accent"
            href={`/api/v1/inventory/export?${exportQuery.toString()}`}
          >
            Export CSV
          </a>
        ) : null
      }
    >
      <Suspense>
        <InventoryFilterBar
          action="/inventory/register"
          fields={["q", "plant", "category", "material", "grade", "form", "uom", "status", "thickness", "minAvailable", "maxAvailable"]}
          options={options}
          searchPlaceholder="Material name or SKU"
        />
      </Suspense>
      <p className="text-sm text-muted">{list.total} matching materials</p>
      <DataTable
        columns={[
          { id: "code", header: <SortHeader action="/inventory/register" id="code" label="SKU" />, cell: (row) => row.code },
          { id: "name", header: <SortHeader action="/inventory/register" id="name" label="Material" />, cell: (row) => row.name },
          { id: "category", header: <SortHeader action="/inventory/register" id="category" label="Category" />, cell: (row) => row.category },
          { id: "form", header: "Form", cell: (row) => row.productForm },
          { id: "grade", header: "Grade", cell: (row) => row.grade },
          { id: "dims", header: "Thickness", cell: (row) => row.thickness ?? "—" },
          { id: "plant", header: <SortHeader action="/inventory/register" id="plant" label="Factory" />, cell: (row) => row.plant },
          { id: "location", header: "Location", cell: (row) => row.location },
          { id: "uom", header: "UOM", cell: (row) => row.uom },
          { id: "available", header: <SortHeader action="/inventory/register" id="available" label="Available" />, cell: (row) => formatQty(row.available, row.uom) },
          { id: "reserved", header: <SortHeader action="/inventory/register" id="reserved" label="Reserved" />, cell: (row) => formatQty(row.reserved, row.uom) },
          { id: "qcHold", header: <SortHeader action="/inventory/register" id="qcHold" label="QC hold" />, cell: (row) => formatQty(row.qcHold, row.uom) },
          { id: "rejected", header: <SortHeader action="/inventory/register" id="rejected" label="Rejected" />, cell: (row) => formatQty(row.rejected, row.uom) },
          { id: "wip", header: "WIP", cell: (row) => formatQty(row.wip, row.uom) },
          { id: "finished", header: "Finished", cell: (row) => formatQty(row.finished, row.uom) },
          { id: "scrap", header: "Scrap", cell: (row) => formatQty(row.scrap, row.uom) },
          { id: "physical", header: <SortHeader action="/inventory/register" id="physical" label="Physical" />, cell: (row) => formatQty(row.physical, row.uom) },
          { id: "reorder", header: "Reorder", cell: (row) => (row.reorderLevel ? formatQty(row.reorderLevel, row.uom) : "—") },
          { id: "moved", header: "Last movement", cell: (row) => when(row.lastMovementAt) },
          { id: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} /> },
        ]}
        rows={list.rows}
        getRowKey={(row) => `${row.plantId}-${row.materialId}`}
        getRowHref={(row) => `/inventory/materials/${row.materialId}`}
        emptyTitle="No stock rows match these filters"
        emptyDetail="Clear filters or post a goods receipt to create batch balances."
      />
      <InventoryPager action="/inventory/register" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
