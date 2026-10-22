import { CreateDialog } from "@/components/create-dialog";
import { MoveForm } from "@/components/forms";
import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, when } from "@/lib/format";
import { ADJUSTMENT_REASONS } from "@/modules/inventory/constants";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listAdjustments } from "@/modules/inventory/queries";
import { listBalances, listLocations } from "@/lib/queries";

export default async function AdjustPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.move");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options, balances, locations] = await Promise.all([
    listAdjustments(filters),
    inventoryFilterOptions(plantIds),
    listBalances(plantIds),
    listLocations(plantIds),
  ]);

  return (
    <DeskListShell
      title="Stock adjustments"
      detail="Adjustments post through the inventory ledger. Balances are never overwritten directly. A reason is required and the signed quantity is stored immutably."
      action={
        <CreateDialog label="Post adjustment" title="Post stock adjustment">
          <MoveForm
            mode="adjust"
            reasons={ADJUSTMENT_REASONS}
            batches={balances.map((row) => ({ id: row.batchId, label: `${row.batchNo} · ${row.material}` }))}
            locations={locations.map((row) => ({ id: row.id, label: `${row.warehouse.code} / ${row.code}` }))}
          />
        </CreateDialog>
      }
    >
      <InventoryFilterBar action="/inventory/adjust" fields={["q", "plant", "material", "from", "to"]} options={options} />
      <p className="text-sm text-muted">{list.total} posted adjustments. There is no separate approval queue — posting requires inventory.move.</p>
      <DataTable
        columns={[
          { id: "when", header: "When", cell: (row) => when(row.when) },
          { id: "material", header: "Material", cell: (row) => `${row.material} (${row.code})` },
          { id: "batch", header: "Batch", cell: (row) => row.batchNo },
          { id: "qty", header: "Qty", cell: (row) => formatQty(row.qty, row.uom) },
          { id: "reason", header: "Reason", cell: (row) => row.reason ?? "—" },
          { id: "user", header: "By", cell: (row) => row.performedBy },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/inventory/movements/${row.id}`}
        emptyTitle="No adjustments posted"
        emptyDetail="Use Post adjustment to correct counted quantity through the ledger."
      />
      <InventoryPager action="/inventory/adjust" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
