import { CreateDialog } from "@/components/create-dialog";
import { IdAction, MaintenanceForm } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listMachines, listMaintenance } from "@/lib/queries";

export default async function MaintenancePage() {
  const session = await requirePage("machine.manage");
  const [machines, tickets] = await Promise.all([listMachines(session.plantIds), listMaintenance(session.plantIds)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" detail="A down machine cannot start a normal job." action={<CreateDialog label="Open ticket" title="Open breakdown ticket"><MaintenanceForm machines={machines.map((row) => ({ id: row.id, name: `${row.code} · ${row.name}` }))} /></CreateDialog>} />
      <SimpleTable emptyTitle="No breakdown tickets" emptyDetail="Open a ticket when a machine is down. Releasing it returns the machine to idle." columns={["Ticket", "Machine", "Issue", "Status", ""]} rows={tickets.map((row) => [row.number, row.machine.code, row.issue, row.status, row.status === "open" ? <IdAction key={row.id} url={`/api/v1/maintenance/${row.id}/release`} label="Release machine" /> : "—"])} />
    </div>
  );
}
