import { CreateDialog } from "@/components/create-dialog";
import { MoveForm } from "@/components/forms";
import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { InterFactoryCreateForm } from "@/components/inventory/inter-factory-forms";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listInterFactoryTransfers, locationsByPlant, transferableBatches } from "@/modules/inventory/queries";
import { listBalances, listLocations } from "@/lib/queries";

export default async function TransferPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.move");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options, batches, locations, intraBalances, intraLocations] = await Promise.all([
    listInterFactoryTransfers(filters),
    inventoryFilterOptions(plantIds),
    transferableBatches(plantIds),
    locationsByPlant(plantIds),
    listBalances(plantIds),
    listLocations(plantIds),
  ]);

  return (
    <DeskListShell
      title="Stock transfers"
      detail="Location moves stay inside one factory. Inter-factory transfers reserve source stock at dispatch and only create destination QC-hold stock on receipt."
      action={
        <span className="flex flex-wrap gap-2">
          {options.plants.length > 1 ? (
            <CreateDialog label="Inter-factory transfer" title="Create inter-factory transfer">
              <InterFactoryCreateForm plants={options.plants} batches={batches} locations={locations} />
            </CreateDialog>
          ) : null}
          <CreateDialog label="Location transfer" title="Move stock between locations">
            <MoveForm
              mode="transfer"
              batches={intraBalances.map((row) => ({ id: row.batchId, label: `${row.batchNo} · ${row.material}` }))}
              locations={intraLocations.map((row) => ({ id: row.id, label: `${row.warehouse.code} / ${row.code}` }))}
            />
          </CreateDialog>
        </span>
      }
    >
      <InventoryFilterBar
        action="/inventory/transfer"
        fields={["q", "plant", "status"]}
        options={options}
        statusOptions={[
          { value: "draft", label: "Draft" },
          { value: "in_transit", label: "In transit" },
          { value: "received", label: "Received" },
          { value: "cancelled", label: "Cancelled" },
        ]}
      />
      <p className="text-sm text-muted">{list.total} inter-factory transfers</p>
      <DataTable
        columns={[
          { id: "when", header: "Created", cell: (row) => when(row.when) },
          { id: "source", header: "From", cell: (row) => row.sourcePlant },
          { id: "dest", header: "To", cell: (row) => row.destPlant },
          { id: "material", header: "Material", cell: (row) => `${row.material} (${row.code})` },
          { id: "batch", header: "Batch", cell: (row) => row.batchNo },
          { id: "qty", header: "Requested", cell: (row) => formatQty(row.requested, row.uom) },
          { id: "dispatched", header: "Dispatched", cell: (row) => formatQty(row.dispatched, row.uom) },
          { id: "received", header: "Received", cell: (row) => formatQty(row.received, row.uom) },
          { id: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} /> },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/inventory/transfers/${row.id}`}
        emptyTitle="No inter-factory transfers"
        emptyDetail={options.plants.length > 1 ? "Create a transfer to move a batch between factories." : "A second factory is required for inter-factory transfers. Use location transfer for moves inside this plant."}
      />
      <InventoryPager action="/inventory/transfer" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
