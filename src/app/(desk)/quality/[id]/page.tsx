import { notFound } from "next/navigation";
import { DecisionButtons } from "@/components/forms";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { kg, labelFor, toneFor } from "@/lib/format";
import { inspectionDetail } from "@/lib/queries";

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("qc.decide");
  const { id } = await params;
  const inspection = await inspectionDetail(id, session.plantIds);
  if (!inspection) notFound();
  const measurements = Object.entries(inspection.measurements as Record<string, unknown>);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={`${labelFor(inspection.kind)} inspection`} detail={inspection.batch?.batchNo ?? inspection.job?.number ?? ""} action={<StatusBadge label={labelFor(inspection.status)} tone={toneFor(inspection.status)} />} />
      {inspection.batch ? (
        <section className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-4">
          <div><p className="text-xs text-muted">Material</p><p className="font-medium">{inspection.batch.material.name}</p></div>
          <div><p className="text-xs text-muted">Grade</p><p className="font-medium">{inspection.batch.grade ?? "—"}</p></div>
          <div><p className="text-xs text-muted">Thickness</p><p className="font-medium">{inspection.batch.thickness?.toString() ?? "—"} mm</p></div>
          <div><p className="text-xs text-muted">Batch weight</p><p className="font-medium">{kg(inspection.batch.weight)}</p></div>
        </section>
      ) : null}
      {inspection.job ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Submitted production</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-muted">Good</p><p>{kg(inspection.job.goodQty)}</p></div><div><p className="text-muted">Reject</p><p>{kg(inspection.job.rejectQty)}</p></div><div><p className="text-muted">Scrap</p><p>{kg(inspection.job.scrapQty)}</p></div></div>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-semibold">Measurements</h2>
        <SimpleTable emptyTitle="No measurements recorded" emptyDetail="Review the material and add a clear inspector remark before making a non-pass decision." columns={["Check", "Value"]} rows={measurements.map(([name, value]) => [labelFor(name), valueText(value)])} />
      </section>
      {inspection.remarks ? <p className="rounded-xl bg-surface-muted p-3 text-sm"><span className="font-semibold">Previous remark:</span> {inspection.remarks}</p> : null}
      {inspection.status === "pending" || inspection.status === "hold" ? <section className="rounded-2xl border border-border bg-card p-4"><h2 className="mb-3 font-semibold">Record decision</h2><DecisionButtons id={inspection.id} /></section> : null}
    </div>
  );
}
