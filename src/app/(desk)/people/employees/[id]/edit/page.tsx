import { EditEmployeeForm, type EmployeeEditValues } from "@/components/employee-actions";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getEmployee, listShifts } from "@/lib/queries";
import { notFound, redirect } from "next/navigation";

const roles = ["admin", "sales", "purchase", "supervisor", "operator", "qc"] as const;

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("employee.manage");
  if (!session.roles.has("admin")) redirect("/access-denied");
  const { id } = await params;
  const [employee, shifts] = await Promise.all([getEmployee(id, session.plantIds), listShifts(session.plantIds)]);
  if (!employee || !employee.user) notFound();
  const roleCode =
    roles.find((code) => employee.user!.userRoles.some((link) => link.role.code === code)) ?? "operator";
  const email = employee.user.email.endsWith("@staff.ssflow.local") ? "" : employee.user.email;
  const values: EmployeeEditValues = {
    id: employee.id,
    name: employee.name,
    code: employee.code,
    designation: employee.designation ?? "",
    skill: employee.skill ?? "",
    shiftId: employee.shiftId ?? "",
    email,
    roleCode,
  };
  return (
    <DeskFormPage title="Edit employee" backHref={`/people/employees/${id}`} backLabel="Back to employee">
      <EditEmployeeForm
        employee={values}
        shifts={shifts.map((row) => ({ id: row.id, name: row.name }))}
        redirectTo={`/people/employees/${id}`}
      />
    </DeskFormPage>
  );
}
