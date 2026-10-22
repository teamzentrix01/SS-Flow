import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/desk";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS } from "@/modules/inventory/constants";
import { materialInventoryDetail } from "@/modules/inventory/queries";
import { qtyText } from "@/lib/domain/qty";

export default async function MaterialInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const detail = await materialInventoryDetail(id, plantIds);
  if (!detail) notFound();
  const { material, totals } = detail;
  const specs = material.productCategory?.requiredSpecs ?? [];
  const tabs = [
    { id: "overview", label: "Overview", href: `/inventory/materials/${id}?tab=overview` },
    { id: "batches", label: "Batches", href: `/inventory/materials/${id}?tab=batches` },
    { id: "movements", label: "Movement history", href: `/inventory/materials/${id}?tab=movements` },
    { id: "purchase", label: "Purchase & GRN", href: `/inventory/materials/${id}?tab=purchase` },
    { id: "qc", label: "QC history", href: `/inventory/materials/${id}?tab=qc` },
    { id: "reservations", label: "Reservations", href: `/inventory/materials/${id}?tab=reservations` },
    { id: "audit", label: "Audit history", href: `/inventory/materials/${id}?tab=audit` },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <PageHeader
        title={`${material.name} (${material.code})`}
        detail={`${material.plant.name} · ${material.productCategory?.name ?? material.category} · ${material.uom}`}
        action={<Link className="text-sm font-medium text-accent underline" href="/inventory/register">Back to register</Link>}
      />
      <InventoryTabs tabs={tabs} current={tab} />
      {tab === "overview" ? (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Available (ATP)", totals.available],
              ["Reserved", totals.reserved],
              ["QC hold", totals.qcHold],
              ["Rejected", totals.rejected],
              ["WIP", totals.wip],
              ["Finished", totals.finished],
              ["Scrap", totals.scrap],
              ["Physical", totals.physical],
            ].map(([label, value]) => (
              <article key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 font-semibold tabular-nums">{formatQty(value, material.uom)}</p>
              </article>
            ))}
          </section>
          <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
            <div><dt className="text-sm text-muted">Grade</dt><dd className="font-medium">{material.grade ?? "—"}</dd></div>
            <div><dt className="text-sm text-muted">Form</dt><dd className="font-medium">{material.shape}</dd></div>
            <div><dt className="text-sm text-muted">Thickness</dt><dd className="font-medium">{specs.includes("thickness") || material.thickness ? material.thickness?.toString() ?? "—" : "—"}</dd></div>
            <div><dt className="text-sm text-muted">Width</dt><dd className="font-medium">{material.width?.toString() ?? "—"}</dd></div>
            <div><dt className="text-sm text-muted">Length</dt><dd className="font-medium">{material.length?.toString() ?? "—"}</dd></div>
            <div><dt className="text-sm text-muted">Diameter</dt><dd className="font-medium">{material.diameter?.toString() ?? "—"}</dd></div>
            <div><dt className="text-sm text-muted">Purchase allowed</dt><dd className="font-medium">{material.purchaseAllowed ? "Yes" : "No"}</dd></div>
            <div><dt className="text-sm text-muted">Manufacturing allowed</dt><dd className="font-medium">{material.manufacturingAllowed ? "Yes" : "No"}</dd></div>
            <div><dt className="text-sm text-muted">Reorder level</dt><dd className="font-medium">{material.reorderLevel ? formatQty(material.reorderLevel.toString(), material.uom) : "Not configured"}</dd></div>
          </dl>
        </div>
      ) : null}
      {tab === "batches" ? (
        <DataTable
          columns={[
            { id: "batch", header: "Batch", cell: (row) => row.batchNo },
            { id: "supplier", header: "Supplier batch", cell: (row) => row.supplierBatchNo ?? "—" },
            { id: "heat", header: "Heat", cell: (row) => row.heatNo ?? "—" },
            { id: "qc", header: "QC", cell: (row) => <StatusBadge label={labelFor(row.qualityStatus)} tone={toneFor(row.qualityStatus)} /> },
            { id: "grn", header: "GRN", cell: (row) => row.receiptItems[0]?.receipt.number ?? "—" },
          ]}
          rows={detail.batches}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/inventory/batches/${row.id}`}
          emptyTitle="No batches for this material"
        />
      ) : null}
      {tab === "movements" ? (
        <SimpleTable
          columns={["When", "Type", "Batch", "Qty"]}
          rows={detail.movements.map((row) => [when(row.createdAt), MOVEMENT_TYPE_LABELS[row.movementType as keyof typeof MOVEMENT_TYPE_LABELS] ?? row.movementType, row.batch.batchNo, qtyText(row.qty)])}
          rowHrefs={detail.movements.map((row) => `/inventory/movements/${row.id}`)}
          emptyTitle="No movements"
        />
      ) : null}
      {tab === "purchase" ? (
        <SimpleTable
          columns={["PO", "Supplier", "Ordered", "Accepted", "GRN"]}
          rows={detail.poItems.map((row) => [
            row.order.number,
            row.order.supplier.name,
            qtyText(row.qty),
            qtyText(row.receivedQty),
            row.receiptItems.map((item) => item.receipt.number).join(", ") || "—",
          ])}
          rowHrefs={detail.poItems.map((row) => `/purchase-orders/${row.orderId}`)}
          emptyTitle="No purchase history"
        />
      ) : null}
      {tab === "qc" ? (
        <SimpleTable
          columns={["When", "Batch", "Kind", "Status"]}
          rows={detail.inspections.map((row) => [when(row.createdAt), row.batch?.batchNo ?? "—", row.kind, row.status])}
          rowHrefs={detail.inspections.map((row) => `/quality/${row.id}`)}
          emptyTitle="No QC history"
        />
      ) : null}
      {tab === "reservations" ? (
        <SimpleTable
          columns={["When", "Batch", "Qty", "Status", "Reference"]}
          rows={detail.reservations.map((row) => [when(row.createdAt), row.batch.batchNo, qtyText(row.qty), row.status, row.referenceType])}
          emptyTitle="No reservations"
        />
      ) : null}
      {tab === "audit" ? (
        <SimpleTable
          columns={["When", "Action", "Reason"]}
          rows={detail.audits.map((row) => [when(row.createdAt), row.action, row.reason ?? "—"])}
          emptyTitle="No audit events for this material id"
          emptyDetail="Batch-level audit events remain on the batch page."
        />
      ) : null}
    </div>
  );
}
