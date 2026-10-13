import { MachineForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listDepartments } from "@/lib/queries";

export default async function NewMachinePage() {
  const session = await requirePage("machine.manage");
  const departments = await listDepartments(session.plantIds);
  return (
    <DeskFormPage title="Create machine" backHref="/machines" backLabel="Back to machines">
      <MachineForm departments={departments.map((row) => ({ id: row.id, name: row.name }))} />
    </DeskFormPage>
  );
}
