import { EmployeeForm } from "@/components/forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listShifts } from "@/lib/queries";

export default async function NewEmployeePage() {
  const session = await requirePage("employee.manage");
  const shifts = await listShifts(session.plantIds);
  const admin = session.roles.has("admin");
  return (
    <DeskFormPage title="Create employee" backHref="/people/employees" backLabel="Back to employees">
      <EmployeeForm
        shifts={shifts.map((row) => ({ id: row.id, name: row.name }))}
        canAssignAdmin={admin}
      />
    </DeskFormPage>
  );
}
