import { UserCreateForm } from "@/components/user-create-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listDepartments, listShifts, listSuppliers, plantSetup } from "@/lib/queries";
import { listActiveDesignations } from "@/modules/rbac/designations";

export default async function NewUserPage() {
  const session = await requirePage("user.manage");
  const [departments, designations, shifts, setup, suppliers] = await Promise.all([
    listDepartments(session.plantIds),
    listActiveDesignations(session.plantIds),
    listShifts(session.plantIds),
    plantSetup(session.plantIds),
    listSuppliers(session.plantIds),
  ]);
  return (
    <DeskFormPage title="New user" backHref="/users" backLabel="Back to users">
      <p className="mb-4 text-sm text-muted">
        Choose account type first. Staff employees get HR fields here—no separate employee or permissions form.
      </p>
      <UserCreateForm
        options={{
          departments: departments.map((d) => ({ id: d.id, name: d.name })),
          designations,
          shifts: shifts.map((s) => ({ id: s.id, name: s.name })),
          plants: setup.plants.map((p) => ({ id: p.id, name: p.name, code: p.code })),
          customers: [],
          suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code })),
          defaultPlantIds: session.plantIds.slice(0, 1),
        }}
      />
    </DeskFormPage>
  );
}
