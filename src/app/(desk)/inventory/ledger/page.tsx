import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryPager } from "@/components/inventory/pager";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, when } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES } from "@/modules/inventory/constants";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listStockMovements } from "@/modules/inventory/queries";

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [list, options] = await Promise.all([listStockMovements(filters), inventoryFilterOptions(plantIds)]);
  const canExport = session.permissions.has("report.export");
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  exportQuery.set("kind", "movements");

  return (
    <DeskListShell
      title="Stock movements"
      detail="Append-only ledger. Historical rows are never edited; corrections go through reverse, transfer, or adjustment postings."
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
      <InventoryFilterBar
        action="/inventory/ledger"
        fields={["q", "plant", "category", "material", "type", "from", "to", "ref"]}
        options={options}
        typeOptions={MOVEMENT_TYPES.map((type) => ({ value: type, label: MOVEMENT_TYPE_LABELS[type] }))}
        searchPlaceholder="Material, batch, or heat"
      />
      <p className="text-sm text-muted">{list.total} movements</p>
      <DataTable
        columns={[
          { id: "when", header: "When", cell: (row) => when(row.when) },
          { id: "type", header: "Type", cell: (row) => <StatusBadge label={MOVEMENT_TYPE_LABELS[row.type as keyof typeof MOVEMENT_TYPE_LABELS] ?? labelFor(row.type)} /> },
          { id: "material", header: "Material", cell: (row) => `${row.material} (${row.code})` },
          { id: "batch", header: "Batch", cell: (row) => row.batchNo },
          { id: "qty", header: "Qty", cell: (row) => formatQty(row.qty, row.uom) },
          { id: "source", header: "Source", cell: (row) => row.source },
          { id: "dest", header: "Destination", cell: (row) => row.destination },
          { id: "ref", header: "Reference", cell: (row) => row.reason ?? row.referenceType ?? "—" },
          { id: "user", header: "By", cell: (row) => row.performedBy },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/inventory/movements/${row.id}`}
        emptyTitle="No movements match these filters"
        emptyDetail="Receipts, QC, issues, transfers, and adjustments each add an immutable ledger line."
      />
      <InventoryPager action="/inventory/ledger" page={list.page} pageSize={list.pageSize} total={list.total} />
    </DeskListShell>
  );
}
