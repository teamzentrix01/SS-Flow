import { Plus } from "lucide-react";
import { MachineRowActions } from "@/components/masters/machine-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta, DeskSecondaryCta } from "@/components/desk";
import { MetricCard } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor } from "@/lib/format";
import { listMachines } from "@/lib/queries";

export default async function MachinesPage() {
  const session = await requirePage("machine.manage");
  const machines = await listMachines(session.plantIds);
  const running = machines.filter((row) => row.status === "running").length;
  const down = machines.filter((row) => row.status === "down").length;
  const idle = machines.length - running - down;
  return (
    <DeskListShell
      title="Machines"
      detail="A down machine cannot start a job."
      action={
        <span className="flex flex-wrap items-center gap-3">
          <DeskSecondaryCta href="/dies">Manage dies catalog</DeskSecondaryCta>
          <DeskPrimaryCta href="/machines/new" icon={Plus}>
            Create machine
          </DeskPrimaryCta>
        </span>
      }
    >
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
      <DataTable
        columns={[
          { id: "code", header: "Code", cell: (row) => row.code },
          { id: "name", header: "Name", cell: (row) => row.name },
          { id: "type", header: "Type", cell: (row) => row.machineType },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} />
            ),
          },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[72px] text-right",
            cellClassName: "text-right",
            stopRowClick: true,
            cell: (row) => <MachineRowActions id={row.id} />,
          },
        ]}
        rows={machines}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/machines/${row.id}`}
      />
    </DeskListShell>
  );
}
