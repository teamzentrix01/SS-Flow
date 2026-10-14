import { EditEmployeeForm, type EmployeeEditValues } from "@/components/employee-actions";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getEmployee, listDepartments, listShifts, plantSetup } from "@/lib/queries";
import { listActiveDesignations } from "@/modules/rbac/designations";
import { listAssignableRoles } from "@/modules/rbac/roles";
import { notFound } from "next/navigation";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("employee.manage");
  const { id } = await params;
  const [employee, shifts, departments, designations, roles, setup] = await Promise.all([
    getEmployee(id, session.plantIds),
    listShifts(session.plantIds),
    listDepartments(session.plantIds),
    listActiveDesignations(session.plantIds),
    listAssignableRoles(session),
    plantSetup(session.plantIds),
  ]);
  if (!employee) notFound();
  const email =
    employee.user && !employee.user.email.endsWith("@staff.ssflow.local") ? employee.user.email : "";
  const values: EmployeeEditValues = {
    id: employee.id,
    name: employee.name,
    code: employee.code,
    designationId:
      employee.designationId ??
      employee.designationRecord?.id ??
      designations.find((d) => d.name === employee.designation)?.id ??
      "",
    skill: employee.skill ?? "",
    shiftId: employee.shiftId ?? "",
    departmentId: employee.departmentId ?? "",
    email,
    roleIds: employee.user?.userRoles.map((link) => link.roleId) ?? [],
    plantIds: employee.user?.plantAccess.map((row) => row.plantId) ?? session.plantIds.slice(0, 1),
  };
  const admin = session.roles.has("admin") || session.permissions.has("plant.manage");
  return (
    <DeskFormPage title="Edit employee" backHref={`/employees/${id}`} backLabel="Back to employee">
      <EditEmployeeForm
        employee={values}
        shifts={shifts.map((row) => ({ id: row.id, name: row.name }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        designations={designations}
        plants={setup.plants.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
        roles={roles}
        canAssignAdmin={admin}
        redirectTo={`/employees/${id}`}
      />
    </DeskFormPage>
  );
}
