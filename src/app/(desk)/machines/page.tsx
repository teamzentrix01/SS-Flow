import { CreateDialog } from "@/components/create-dialog";
import { MachineForm } from "@/components/master-forms";
import { MetricCard, PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor } from "@/lib/format";
import { listDepartments, listMachines } from "@/lib/queries";

export default async function MachinesPage() {
  const session = await requirePage("machine.manage");
  const [machines, departments] = await Promise.all([
    listMachines(session.plantIds),
    listDepartments(session.plantIds),
  ]);
  const running = machines.filter((row) => row.status === "running").length;
  const down = machines.filter((row) => row.status === "down").length;
  const idle = machines.length - running - down;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Machines"
        detail="A down machine cannot start a job."
        action={
          <span className="flex flex-wrap items-center gap-3">
            <TextLink href="/dies">Dies</TextLink>
            <CreateDialog label="Create machine" title="Create machine">
              <MachineForm departments={departments.map((row) => ({ id: row.id, name: row.name }))} />
            </CreateDialog>
          </span>
        }
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          tone="lime"
          label="Running"
          value={String(running)}
          detail="Currently producing"
        />
        <MetricCard
          label="Idle"
          value={String(idle)}
          detail="Available for the next job"
        />
        <MetricCard
          tone="coral"
          label="Down"
          value={String(down)}
          detail="Blocked for maintenance"
        />
        <MetricCard
          tone="periwinkle"
          label="Directory"
          value={String(machines.length)}
          detail="Machines in this plant"
        />
      </section>
      <SimpleTable
        columns={["Code", "Name", "Type", "Status"]}
        rows={machines.map((row) => [
          <TextLink key={row.id} href={`/machines/${row.id}`}>
            {row.code}
          </TextLink>,
          row.name,
          row.machineType,
          <StatusBadge
            key={row.id}
            label={labelFor(row.status)}
            tone={toneFor(row.status)}
          />,
        ])}
      />
    </div>
  );
}
