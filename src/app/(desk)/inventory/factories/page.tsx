import Link from "next/link";
import { DataTable, DeskListShell } from "@/components/desk";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor } from "@/lib/format";
import { parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, listFactoryStock } from "@/modules/inventory/queries";

export default async function StockByFactoryPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [factories, options] = await Promise.all([listFactoryStock(filters), inventoryFilterOptions(plantIds)]);

  return (
    <DeskListShell title="Stock by factory" detail="Each factory keeps its own batches and balances. Totals are summed from posted stock rows, not duplicated by joins.">
      <InventoryFilterBar action="/inventory/factories" fields={["plant", "category", "material", "grade", "status"]} options={options} />
      <div className="space-y-8">
        {factories.map((factory) => (
          <section key={factory.id} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{factory.name}</h2>
                <p className="text-sm text-muted">
                  {factory.code} · {factory.skuCount} materials · {factory.lowStock} low-stock
                </p>
              </div>
              <Link className="text-sm font-medium text-accent underline" href={`/inventory/register?plant=${factory.id}`}>
                Open register
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Available", factory.totals.available],
                ["Reserved", factory.totals.reserved],
                ["QC hold", factory.totals.qcHold],
                ["Physical", factory.totals.physical],
              ].map(([label, value]) => (
                <article key={label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatQty(value)}</p>
                </article>
              ))}
            </div>
            <DataTable
              columns={[
                { id: "code", header: "SKU", cell: (row) => row.code },
                { id: "name", header: "Material", cell: (row) => row.name },
                { id: "available", header: "Available", cell: (row) => formatQty(row.available, row.uom) },
                { id: "qcHold", header: "QC hold", cell: (row) => formatQty(row.qcHold, row.uom) },
                { id: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} /> },
              ]}
              rows={factory.rows}
              getRowKey={(row) => row.materialId}
              getRowHref={(row) => `/inventory/materials/${row.materialId}`}
              emptyTitle="No stock at this factory"
              emptyDetail="Posted receipts and production output appear here."
            />
          </section>
        ))}
      </div>
    </DeskListShell>
  );
}
