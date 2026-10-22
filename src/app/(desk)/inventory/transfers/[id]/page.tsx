import { notFound } from "next/navigation";
import { DeskFormPage } from "@/components/desk";
import { TransferActionForm } from "@/components/inventory/inter-factory-forms";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { interFactoryTransferDetail } from "@/modules/inventory/queries";

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("inventory.move");
  const plantIds = await plantIdsForSession(session);
  const { id } = await params;
  const transfer = await interFactoryTransferDetail(id, plantIds);
  if (!transfer) notFound();
  const canAct = session.permissions.has("inventory.move");

  return (
    <DeskFormPage
      title={`Transfer ${transfer.id.slice(0, 8)}`}
      detail={`${transfer.sourcePlant.name} → ${transfer.destinationPlant.name}`}
      backHref="/inventory/transfer"
      backLabel="Back to transfers"
    >
      <div className="mb-4">
        <StatusBadge label={labelFor(transfer.status)} tone={toneFor(transfer.status)} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Material</dt><dd className="font-medium">{transfer.batch.material.name} ({transfer.batch.material.code})</dd></div>
        <div><dt className="text-sm text-muted">Source batch</dt><dd className="font-medium">{transfer.batch.batchNo}</dd></div>
        <div><dt className="text-sm text-muted">Heat</dt><dd className="font-medium">{transfer.batch.heatNo ?? "—"}</dd></div>
        <div><dt className="text-sm text-muted">Requested</dt><dd className="font-medium">{formatQty(transfer.requestedQty.toString(), transfer.uom)}</dd></div>
        <div><dt className="text-sm text-muted">Dispatched</dt><dd className="font-medium">{formatQty(transfer.dispatchedQty.toString(), transfer.uom)}</dd></div>
        <div><dt className="text-sm text-muted">Received</dt><dd className="font-medium">{formatQty(transfer.receivedQty.toString(), transfer.uom)}</dd></div>
        <div><dt className="text-sm text-muted">Rejected / damaged</dt><dd className="font-medium">{formatQty(transfer.rejectedQty.toString(), transfer.uom)}</dd></div>
        <div><dt className="text-sm text-muted">Created</dt><dd className="font-medium">{when(transfer.createdAt)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-muted">Notes</dt><dd className="font-medium">{transfer.notes ?? "—"}</dd></div>
      </dl>
      {canAct && transfer.status === "draft" ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <TransferActionForm transferId={transfer.id} mode="approve" defaultQty={transfer.requestedQty.toString()} />
          <TransferActionForm transferId={transfer.id} mode="cancel" defaultQty={transfer.requestedQty.toString()} />
        </div>
      ) : null}
      {canAct && transfer.status === "in_transit" ? (
        <div className="mt-6">
          <p className="mb-2 text-sm text-muted">Received + rejected must equal dispatched quantity. Accepted quantity posts to QC hold at the destination.</p>
          <TransferActionForm transferId={transfer.id} mode="receive" defaultQty={transfer.dispatchedQty.toString()} />
        </div>
      ) : null}
    </DeskFormPage>
  );
}
