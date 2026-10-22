import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskFormPage } from "@/components/desk";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, when } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS } from "@/modules/inventory/constants";
import { stockMovementDetail } from "@/modules/inventory/queries";

function referenceHref(type: string | null, id: string | null) {
  if (!type || !id) return null;
  if (type === "goods_receipt") return `/receipts/${id}`;
  if (type === "stock_transfer") return `/inventory/transfers/${id}`;
  if (type === "job" || type === "job_plan") return `/jobs/${id}`;
  if (type === "sales_order") return `/sales/${id}`;
  return null;
}

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("inventory.view");
  const plantIds = await plantIdsForSession(session);
  const { id } = await params;
  const row = await stockMovementDetail(id, plantIds);
  if (!row) notFound();
  const href = referenceHref(row.referenceType, row.referenceId);
  const typeLabel = MOVEMENT_TYPE_LABELS[row.type as keyof typeof MOVEMENT_TYPE_LABELS] ?? labelFor(row.type);

  return (
    <DeskFormPage title={typeLabel} detail={`${row.batchNo} · ${formatQty(row.qty, row.uom)}`} backHref="/inventory/ledger" backLabel="Back to movements">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">When</dt><dd className="font-medium">{when(row.when)}</dd></div>
        <div><dt className="text-sm text-muted">Type</dt><dd><StatusBadge label={typeLabel} /></dd></div>
        <div><dt className="text-sm text-muted">Material</dt><dd className="font-medium">{row.material} ({row.code})</dd></div>
        <div><dt className="text-sm text-muted">Batch</dt><dd className="font-medium"><Link className="text-accent underline" href={`/inventory/batches/${row.batchId}`}>{row.batchNo}</Link></dd></div>
        <div><dt className="text-sm text-muted">Heat</dt><dd className="font-medium">{row.heatNo ?? "—"}</dd></div>
        <div><dt className="text-sm text-muted">Factory</dt><dd className="font-medium">{row.plant}</dd></div>
        <div><dt className="text-sm text-muted">Source</dt><dd className="font-medium">{row.source}</dd></div>
        <div><dt className="text-sm text-muted">Destination</dt><dd className="font-medium">{row.destination}</dd></div>
        <div><dt className="text-sm text-muted">Quantity</dt><dd className="font-medium">{formatQty(row.qty, row.uom)}</dd></div>
        <div><dt className="text-sm text-muted">Performed by</dt><dd className="font-medium">{row.performedBy}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-muted">Reason</dt><dd className="font-medium">{row.reason ?? "—"}</dd></div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted">Source document</dt>
          <dd className="font-medium">
            {href ? <Link className="text-accent underline" href={href}>{row.referenceType} {row.referenceId?.slice(0, 8)}</Link> : (row.referenceType ?? "—")}
          </dd>
        </div>
      </dl>
    </DeskFormPage>
  );
}
