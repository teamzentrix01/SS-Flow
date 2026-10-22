import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listInventoryQc } from "@/modules/inventory/queries";

export default async function InventoryQcPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options] = await Promise.all([listInventoryQc(filters), inventoryFilterOptions(plantIds)]);
  const canDecide = session.permissions.has("qc.decide");

  return (
    <DeskListShell
      title="QC & inspection"
      detail="Incoming inspections opened by posted GRNs. QC-hold stock is not available to reserve or consume until an authorized release."
    >
      <InventoryFilterBar
        action="/inventory/qc"
        fields={["q", "plant", "category", "material", "status"]}
        options={options}
        statusOptions={[
          { value: "pending", label: "Pending" },
          { value: "pass", label: "Pass" },
          { value: "hold", label: "Hold" },
          { value: "fail", label: "Fail" },
          { value: "rework", label: "Rework" },
        ]}
        searchPlaceholder="Material, batch, or heat"
      />
      <p className="text-sm text-muted">{list.total} inspections</p>
      <DataTable
        columns={[
          { id: "when", header: "Opened", cell: (row) => when(row.when) },
          { id: "material", header: "Material", cell: (row) => `${row.material} (${row.code})` },
          { id: "supplier", header: "Supplier", cell: (row) => row.supplier },
          { id: "po", header: "PO", cell: (row) => row.po },
          { id: "grn", header: "GRN", cell: (row) => row.grn },
          { id: "plants", header: "Intended / received", cell: (row) => `${row.intendedPlant} / ${row.receivingPlant}` },
          { id: "delivered", header: "Delivered", cell: (row) => row.delivered },
          { id: "accepted", header: "Accepted", cell: (row) => row.accepted },
          { id: "rejected", header: "Rejected", cell: (row) => row.rejected },
          { id: "hold", header: "QC hold", cell: (row) => formatQty(row.qcHold) },
          { id: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} /> },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => (canDecide ? `/quality/${row.id}` : row.batchId ? `/inventory/batches/${row.batchId}` : undefined)}
        emptyTitle="No incoming inspections"
        emptyDetail="Post a goods receipt to open incoming QC. Draft GRNs do not create stock or inspections."
      />
      <InventoryPager action="/inventory/qc" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
