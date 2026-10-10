import { CreateDialog } from "@/components/create-dialog";
import { DieForm } from "@/components/master-forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor } from "@/lib/format";
import { listDies } from "@/lib/queries";

export default async function DiesPage() {
  const session = await requirePage("machine.manage");
  const dies = await listDies(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Dies and formas" action={<CreateDialog label="Create die" title="Create die"><DieForm /></CreateDialog>} />
      <SimpleTable columns={["Code", "Type", "Life", "Status"]} rows={dies.map((row) => [row.code, row.dieType, `${row.lifeUsed} / ${row.lifeLimit}`, <StatusBadge key={row.id} label={labelFor(row.status)} tone={toneFor(row.status)} />])} />
    </div>
  );
}
