import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardCheck,
  Factory,
  Layers,
  Package,
  PackageCheck,
  PackageX,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { InventoryFilterBar } from "@/components/inventory/filter-bar";
import { InventoryBarChart } from "@/components/inventory/qty-bars";
import { DataTable, DeskListShell } from "@/components/desk";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor } from "@/lib/format";
import { inventoryHref, parseInventoryFilters, type InventorySearchParams } from "@/modules/inventory/filters";
import { inventoryFilterOptions, inventoryOverview } from "@/modules/inventory/queries";

export default async function InventoryOverviewPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const filters = parseInventoryFilters(params, plantIds);
  const [overview, options] = await Promise.all([inventoryOverview(filters), inventoryFilterOptions(plantIds)]);
  const query = {
    plant: filters.plantId,
    category: filters.categoryId,
    material: filters.materialId,
    grade: filters.grade,
    status: filters.status,
    from: params.from,
    to: params.to,
  };
  const canMove = session.permissions.has("inventory.move");
  const cards = [
    { href: inventoryHref("/inventory/register", query), label: "Active SKUs", value: String(overview.skuCount), icon: Package, iconClass: "bg-[#3b82f6] text-white", cardClass: "border-[#bfdbfe] bg-[#eff6ff]" },
    { href: inventoryHref("/inventory/register", { ...query, status: "available" }), label: "Available stock", value: formatQty(overview.totals.available), icon: PackageCheck, iconClass: "bg-[#22c55e] text-white", cardClass: "border-[#bbf7d0] bg-[#f0fdf4]" },
    { href: "/inventory/reservations", label: "Reserved stock", value: formatQty(overview.totals.reserved), icon: Layers, iconClass: "bg-[#6366f1] text-white", cardClass: "border-[#c7d2fe] bg-[#eef2ff]" },
    { href: inventoryHref("/inventory/register", { ...query, status: "qc_hold" }), label: "QC-hold stock", value: formatQty(overview.totals.qcHold), icon: ShieldAlert, iconClass: "bg-[#f59e0b] text-white", cardClass: "border-[#fde68a] bg-[#fffbeb]" },
    { href: inventoryHref("/inventory/register", { ...query, status: "rejected" }), label: "Rejected stock", value: formatQty(overview.totals.rejected), icon: PackageX, iconClass: "bg-[#ef4444] text-white", cardClass: "border-[#fecaca] bg-[#fef2f2]" },
    { href: inventoryHref("/inventory/register", query), label: "WIP stock", value: formatQty(overview.totals.wip), icon: Factory, iconClass: "bg-[#0ea5e9] text-white", cardClass: "border-[#bae6fd] bg-[#f0f9ff]" },
    { href: inventoryHref("/inventory/register", query), label: "Finished goods", value: formatQty(overview.totals.finished), icon: ShieldCheck, iconClass: "bg-[#16a34a] text-white", cardClass: "border-[#bbf7d0] bg-[#f0fdf4]" },
    { href: inventoryHref("/inventory/register", query), label: "Scrap stock", value: formatQty(overview.totals.scrap), icon: Trash2, iconClass: "bg-[#78716c] text-white", cardClass: "border-[#e7e5e4] bg-[#fafaf9]" },
    { href: inventoryHref("/inventory/alerts", { ...query, status: "low_stock" }), label: "Low-stock items", value: String(overview.lowStock), icon: AlertTriangle, iconClass: "bg-[#f59e0b] text-white", cardClass: "border-[#fde68a] bg-[#fffbeb]" },
    { href: inventoryHref("/inventory/alerts", { ...query, status: "out_of_stock" }), label: "Out-of-stock items", value: String(overview.outOfStock), icon: PackageX, iconClass: "bg-[#ef4444] text-white", cardClass: "border-[#fecaca] bg-[#fef2f2]" },
    { href: inventoryHref("/inventory/qc", { status: "pending" }), label: "Pending QC", value: String(overview.pendingQc), icon: ClipboardCheck, iconClass: "bg-[#f59e0b] text-white", cardClass: "border-[#fde68a] bg-[#fffbeb]" },
    { href: "/purchase-orders?status=approved", label: "Open PO outstanding", value: formatQty(overview.outstandingPoQty), icon: ShoppingCart, iconClass: "bg-[#2563eb] text-white", cardClass: "border-[#bfdbfe] bg-[#eff6ff]" },
    { href: inventoryHref("/inventory/transfer", { status: "in_transit" }), label: "Open transfers", value: String(overview.openTransfers), icon: ArrowLeftRight, iconClass: "bg-[#0ea5e9] text-white", cardClass: "border-[#bae6fd] bg-[#f0f9ff]" },
  ];

  return (
    <DeskListShell
      title="Inventory overview"
      detail="Factory-aware stock totals from posted balances. Available-to-promise is the available bucket only — QC-hold, reserved, and rejected stock stay separate."
      action={
        <span className="flex flex-wrap gap-2">
          <Link className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold hover:border-accent" href="/inventory/register">
            Stock register
          </Link>
          {canMove ? (
            <Link className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold hover:border-accent" href="/inventory/transfer">
              Transfers
            </Link>
          ) : null}
          {canMove ? (
            <Link className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold hover:border-accent" href="/inventory/adjust">
              Adjust
            </Link>
          ) : null}
        </span>
      }
    >
      <InventoryFilterBar
        action="/inventory"
        fields={["plant", "category", "material", "grade", "status", "from", "to"]}
        options={options}
      />
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(168px,1fr))]">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="block rounded-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            <KpiCard label={card.label} value={card.value} icon={card.icon} iconClassName={card.iconClass} cardClassName={card.cardClass} />
          </Link>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryBarChart title="Stock by category" items={overview.byCategory} />
        <InventoryBarChart title="Available vs reserved vs QC-hold vs rejected" items={overview.byBucket.filter((row) => ["Available", "Reserved", "QC hold", "Rejected"].includes(row.label))} />
        <InventoryBarChart title="Factory-wise physical stock" items={overview.byPlant} />
        <InventoryBarChart title="Posted movement volume" items={overview.movementTrend} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Low-stock items</h2>
            <Link className="text-sm text-accent underline" href="/inventory/alerts">
              View alerts
            </Link>
          </div>
          <DataTable
            columns={[
              { id: "code", header: "SKU", cell: (row) => row.code },
              { id: "name", header: "Material", cell: (row) => row.name },
              { id: "plant", header: "Factory", cell: (row) => row.plant },
              { id: "available", header: "Available", cell: (row) => formatQty(row.available, row.uom) },
              { id: "reorder", header: "Reorder", cell: (row) => (row.reorderLevel ? formatQty(row.reorderLevel, row.uom) : "—") },
              { id: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} /> },
            ]}
            rows={overview.lowStockItems}
            getRowKey={(row) => `${row.plantId}-${row.materialId}`}
            getRowHref={(row) => `/inventory/materials/${row.materialId}`}
            emptyTitle="No low-stock items"
            emptyDetail="Reorder alerts appear when available quantity falls below the material reorder level."
          />
        </section>
        <section className="space-y-3">
          <h2 className="font-semibold">Fast-moving materials</h2>
          {overview.movementCount ? (
            <DataTable
              columns={[
                { id: "code", header: "SKU", cell: (row) => row.code },
                { id: "name", header: "Material", cell: (row) => row.name },
                { id: "qty", header: "Moved qty", cell: (row) => formatQty(row.qty) },
              ]}
              rows={overview.fastMoving}
              getRowKey={(row) => row.code}
              emptyTitle="Not enough movement history"
              emptyDetail="Fast-moving ranking uses posted ledger quantity in the selected date range."
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">Not enough posted movement history for the current filters.</p>
          )}
          {overview.slowMoving.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Slow-moving with stock</h3>
              <DataTable
                columns={[
                  { id: "code", header: "SKU", cell: (row) => row.code },
                  { id: "name", header: "Material", cell: (row) => row.name },
                  { id: "qty", header: "Physical", cell: (row) => formatQty(row.qty) },
                ]}
                rows={overview.slowMoving}
                getRowKey={(row) => row.code}
              />
            </div>
          ) : null}
        </section>
      </div>
    </DeskListShell>
  );
}
