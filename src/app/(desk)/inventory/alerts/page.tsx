import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listReorderAlerts } from "@/modules/inventory/queries";

export default async function ReorderAlertsPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options] = await Promise.all([listReorderAlerts(filters), inventoryFilterOptions(plantIds)]);
  const canPurchase = session.permissions.has("purchase.manage");

  return (
    <DeskListShell
      title="Reorder & shortage alerts"
      detail="Shortage uses available-to-promise against the material reorder or minimum stock level. Open PO remaining quantity is incoming only — it is not physical stock."
    >
      <InventoryFilterBar
        action="/inventory/alerts"
        fields={["q", "plant", "category", "material", "status"]}
        options={options}
        statusOptions={[
          { value: "low_stock", label: "Low stock" },
          { value: "out_of_stock", label: "Out of stock" },
        ]}
      />
      <p className="text-sm text-muted">{list.total} materials below reorder or with no available stock. Suggested quantity subtracts open PO outstanding.</p>
      <DataTable
        columns={[
          { id: "code", header: "SKU", cell: (row) => row.code },
          { id: "name", header: "Material", cell: (row) => row.name },
          { id: "plant", header: "Factory", cell: (row) => row.plant },
          { id: "available", header: "Available", cell: (row) => formatQty(row.available, row.uom) },
          { id: "reserved", header: "Reserved", cell: (row) => formatQty(row.reserved, row.uom) },
          { id: "hold", header: "QC hold", cell: (row) => formatQty(row.qcHold, row.uom) },
          { id: "incoming", header: "Open PO", cell: (row) => formatQty(row.incoming, row.uom) },
          { id: "reorder", header: "Reorder", cell: (row) => (row.reorderLevel ? formatQty(row.reorderLevel, row.uom) : "—") },
          { id: "shortage", header: "Shortage", cell: (row) => formatQty(row.shortage, row.uom) },
          { id: "suggested", header: "Suggested buy", cell: (row) => formatQty(row.suggested, row.uom) },
          { id: "severity", header: "Severity", cell: (row) => <StatusBadge label={labelFor(row.severity)} tone={toneFor(row.severity)} /> },
        ]}
        rows={list.rows}
        getRowKey={(row) => `${row.plantId}-${row.materialId}`}
        getRowHref={(row) => (canPurchase ? `/purchase-orders/new` : `/inventory/materials/${row.materialId}`)}
        emptyTitle="No shortages for the current filters"
        emptyDetail="Set a reorder or minimum stock level on the material master to generate alerts. This screen does not create purchase orders."
      />
      <InventoryPager action="/inventory/alerts" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
