import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryBarChart } from "@/components/inventory/qty-bars";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, inventoryOverview, listFactoryStock, listReorderAlerts, listStockRegisterAll } from "@/modules/inventory/queries";

export default async function InventoryReportsPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [overview, factories, register, alerts, options] = await Promise.all([
    inventoryOverview(filters),
    listFactoryStock(filters),
    listStockRegisterAll(filters),
    listReorderAlerts(filters),
    inventoryFilterOptions(plantIds),
  ]);
  const canExport = session.permissions.has("report.export");
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return (
    <DeskListShell
      title="Inventory reports"
      detail="Quantity reports from posted balances and the stock ledger. Monetary valuation is not shown because the ERP has no FIFO, weighted-average, or landed-cost policy yet."
      action={
        canExport ? (
          <span className="flex flex-wrap gap-2">
            <a className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold hover:border-accent" href={`/api/v1/inventory/export?${new URLSearchParams({ ...Object.fromEntries(exportQuery), kind: "register" }).toString()}`}>
              Export register
            </a>
            <a className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold hover:border-accent" href={`/api/v1/inventory/export?${new URLSearchParams({ ...Object.fromEntries(exportQuery), kind: "movements" }).toString()}`}>
              Export movements
            </a>
          </span>
        ) : null
      }
    >
      <InventoryFilterBar action="/inventory/reports" fields={["plant", "category", "material", "from", "to"]} options={options} />
      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryBarChart title="Quantity by factory" items={overview.byPlant} />
        <InventoryBarChart title="Quantity by category" items={overview.byCategory} />
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">Factory totals</h2>
        <DataTable
          columns={[
            { id: "factory", header: "Factory", cell: (row) => row.name },
            { id: "available", header: "Available", cell: (row) => formatQty(row.totals.available) },
            { id: "hold", header: "QC hold", cell: (row) => formatQty(row.totals.qcHold) },
            { id: "rejected", header: "Rejected", cell: (row) => formatQty(row.totals.rejected) },
            { id: "physical", header: "Physical", cell: (row) => formatQty(row.totals.physical) },
          ]}
          rows={factories}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/inventory/register?plant=${row.id}`}
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">QC-hold and rejection</h2>
        <DataTable
          columns={[
            { id: "code", header: "SKU", cell: (row) => row.code },
            { id: "name", header: "Material", cell: (row) => row.name },
            { id: "plant", header: "Factory", cell: (row) => row.plant },
            { id: "hold", header: "QC hold", cell: (row) => formatQty(row.qcHold, row.uom) },
            { id: "rejected", header: "Rejected", cell: (row) => formatQty(row.rejected, row.uom) },
          ]}
          rows={register.filter((row) => Number(row.qcHold) > 0 || Number(row.rejected) > 0)}
          getRowKey={(row) => `${row.plantId}-${row.materialId}`}
          getRowHref={(row) => `/inventory/materials/${row.materialId}`}
          emptyTitle="No QC-hold or rejected stock"
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Reorder and shortage</h2>
        <DataTable
          columns={[
            { id: "code", header: "SKU", cell: (row) => row.code },
            { id: "name", header: "Material", cell: (row) => row.name },
            { id: "available", header: "Available", cell: (row) => formatQty(row.available, row.uom) },
            { id: "shortage", header: "Shortage", cell: (row) => formatQty(row.shortage, row.uom) },
          ]}
          rows={alerts.rows}
          getRowKey={(row) => `${row.plantId}-${row.materialId}`}
          emptyTitle="No shortages"
        />
      </section>
    </DeskListShell>
  );
}
