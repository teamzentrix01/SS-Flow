import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listReservations } from "@/modules/inventory/queries";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options] = await Promise.all([listReservations(filters), inventoryFilterOptions(plantIds)]);

  return (
    <DeskListShell title="Stock reservations" detail="Available quantity is reduced when stock is reserved for a sales order or job. QC-hold and rejected buckets cannot be reserved.">
      <InventoryFilterBar
        action="/inventory/reservations"
        fields={["q", "plant", "category", "material", "status"]}
        options={options}
        statusOptions={[
          { value: "active", label: "Active" },
          { value: "issued", label: "Issued" },
        ]}
      />
      <p className="text-sm text-muted">{list.total} reservations</p>
      <DataTable
        columns={[
          { id: "when", header: "When", cell: (row) => when(row.when) },
          { id: "material", header: "Material", cell: (row) => `${row.material} (${row.code})` },
          { id: "batch", header: "Batch", cell: (row) => row.batchNo },
          { id: "plant", header: "Factory", cell: (row) => row.plant },
          { id: "location", header: "Location", cell: (row) => row.location },
          { id: "qty", header: "Qty", cell: (row) => formatQty(row.qty, row.uom) },
          { id: "ref", header: "Reference", cell: (row) => row.salesOrder ?? `${row.referenceType}` },
          { id: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} /> },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/inventory/batches/${row.batchId}`}
        emptyTitle="No reservations"
        emptyDetail="Reservations appear when planning allocates available stock to a job or sales order."
      />
      <InventoryPager action="/inventory/reservations" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
