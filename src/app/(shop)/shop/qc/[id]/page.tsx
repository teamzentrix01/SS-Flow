import { notFound } from "next/navigation";
import { DecisionButtons } from "@/components/forms";
import { requirePage } from "@/lib/access";
import { inspectionDetail } from "@/lib/queries";

export default async function ShopInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("qc.decide");
  const { id } = await params;
  const inspection = await inspectionDetail(id, session.plantIds);
  if (!inspection) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{inspection.kind}</h1>
      <p className="text-sm text-muted">{inspection.batch?.material.name} · {inspection.batch?.batchNo}</p>
      <DecisionButtons id={inspection.id} />
    </div>
  );
}
