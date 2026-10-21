import { notFound } from "next/navigation";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { batchDetail } from "@/lib/queries";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("inventory.view");
  const { id } = await params;
  const batch = await batchDetail(id, session.plantIds);
  if (!batch) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={batch.batchNo} detail={`${batch.material} · ${batch.shape} · grade ${batch.grade ?? "—"} · ${batch.thickness} mm`} action={<StatusBadge label={labelFor(batch.quality)} tone={toneFor(batch.quality)} />} />
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted">Heat</p><p className="font-medium">{batch.heat ?? "—"}</p></article>
        <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted">Width</p><p className="font-medium">{batch.width}</p></article>
        <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted">Supplier batch</p><p className="font-medium">{batch.supplierBatchNo ?? "—"}</p></article>
        <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted">Received</p><p className="font-medium">{batch.receivedQty ?? "—"} {batch.receivedUom ?? ""}</p></article>
        <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted">Actual weight</p><p className="font-medium">{batch.actualWeightKg != null ? `${batch.actualWeightKg} kg` : "Not recorded"}</p></article>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Receipt source and specifications</h2>
        <SimpleTable columns={["GRN", "Purchase order", "Supplier", "Accepted", "Rejected", "Grade", "Thickness", "Width", "Length", "Diameter", "Finish", "Rate"]} rows={batch.sources.map((row) => [row.receiptNo, row.purchaseOrderNo, row.supplier, `${row.acceptedQty} ${row.uom}`, `${row.rejectedQty} ${row.uom}`, row.grade ?? "—", row.thickness ?? "—", row.width ?? "—", row.length ?? "—", row.diameter ?? "—", row.finish ?? "—", row.rate])} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Trace</h2>
        <SimpleTable columns={["Parent batch", "Qty", "Link", "Depth"]} rows={batch.parents.map((row) => [row.batch_no, row.qty, row.link_type, String(row.depth)])} />
        <div className="mt-3"><SimpleTable columns={["Child batch", "Qty", "Link"]} rows={batch.children.map((row) => [row.batchNo, row.qty, row.type])} /></div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Balances</h2>
        <SimpleTable columns={["Location", "UOM", "Available", "Reserved", "QC hold", "WIP", "Finished", "Scrap", "Rejected"]} rows={batch.balances.map((row) => [row.location, row.uom, row.available, row.reserved, row.hold, row.wip, row.finished, row.scrap, row.rejected])} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Production issues</h2>
        <SimpleTable columns={["Job", "Operation", "Required material", "Issued", "Consumed", "Returned", "Substitution"]} rows={batch.issues.map((row) => [row.jobNo, row.jobName, row.requestedMaterial, row.issued, row.consumed, row.returned, row.substitution ?? "—"]) } />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Ledger</h2>
        <SimpleTable columns={["When", "Type", "Qty"]} rows={batch.ledger.map((row) => [when(row.when), row.type, row.qty])} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Audit</h2>
        <SimpleTable columns={["When", "Action", "Reason"]} rows={batch.audits.map((row) => [when(row.when), row.action, row.reason ?? "—"])} />
      </section>
    </div>
  );
}
