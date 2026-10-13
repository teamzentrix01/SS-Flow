import { RequisitionForm } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { listRequisitions } from "@/lib/queries";

export default async function RequisitionsPage() {
  const session = await requirePage("purchase.manage");
  const rows = await listRequisitions(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Purchase requisitions" detail="Consolidated net MRP gaps across sales orders." />
      <section className="rounded-2xl border border-border bg-card p-4">
        <RequisitionForm />
      </section>
      <SimpleTable
        emptyTitle="No requisitions"
        columns={["Number", "Status", "Lines", "Materials"]}
        rows={rows.map((row) => [
          row.number,
          row.status,
          String(row.items.length),
          row.items.map((i) => `${i.material.name} ${kg(i.qty)}`).join(", "),
        ])}
      />
    </div>
  );
}
