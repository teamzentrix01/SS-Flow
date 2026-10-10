import { notFound } from "next/navigation";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { machineDetail } from "@/lib/queries";

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("machine.manage");
  const { id } = await params;
  const machine = await machineDetail(id, session.plantIds);
  if (!machine) notFound();
  return (
    <div className="space-y-5">
      <PageHeader title={machine.code} detail={machine.name} action={<StatusBadge label={labelFor(machine.status)} tone={toneFor(machine.status)} />} />
      <SimpleTable columns={["Downtime reason", "Started", "Ended"]} rows={machine.downtime.map((row) => [row.reason, when(row.startedAt), when(row.endedAt)])} />
    </div>
  );
}
