import { DesignationForm } from "@/components/rbac/designation-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listDepartments } from "@/lib/queries";

export default async function NewDesignationPage() {
  const session = await requirePage("designation.manage");
  const departments = await listDepartments(session.plantIds);
  return (
    <DeskFormPage title="Create designation" backHref="/designations" backLabel="Back to designations">
      <DesignationForm
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        redirectTo="/designations"
      />
    </DeskFormPage>
  );
}
