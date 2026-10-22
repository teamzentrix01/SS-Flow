import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listMaterialBatches } from "@/modules/inventory/queries";

export default async function MaterialBatchesPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options] = await Promise.all([listMaterialBatches(filters), inventoryFilterOptions(plantIds)]);

  return (
    <DeskListShell title="Material batches" detail="Supplier batches and heat numbers stay distinct even when grade and size match.">
      <InventoryFilterBar
        action="/inventory/batches"
        fields={["q", "plant", "category", "material", "grade", "status"]}
        options={options}
        searchPlaceholder="Batch, heat, supplier batch, or SKU"
      />
      <p className="text-sm text-muted">{list.total} batches</p>
      <DataTable
        columns={[
          { id: "batch", header: "Batch", cell: (row) => row.batchNo },
          { id: "supplier", header: "Supplier batch", cell: (row) => row.supplierBatchNo ?? "—" },
          { id: "heat", header: "Heat", cell: (row) => row.heatNo ?? "—" },
          { id: "material", header: "Material", cell: (row) => `${row.material} (${row.code})` },
          { id: "plant", header: "Factory", cell: (row) => row.plant },
          { id: "location", header: "Location", cell: (row) => row.location },
          { id: "available", header: "Available", cell: (row) => formatQty(row.available, row.uom) },
          { id: "hold", header: "QC hold", cell: (row) => formatQty(row.qcHold, row.uom) },
          { id: "rejected", header: "Rejected", cell: (row) => formatQty(row.rejected, row.uom) },
          { id: "quality", header: "QC", cell: (row) => <StatusBadge label={labelFor(row.quality)} tone={toneFor(row.quality)} /> },
          { id: "when", header: "Created", cell: (row) => when(row.createdAt) },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/inventory/batches/${row.id}`}
        emptyTitle="No batches match these filters"
        emptyDetail="A posted goods receipt creates a traceable batch."
      />
      <InventoryPager action="/inventory/batches" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
