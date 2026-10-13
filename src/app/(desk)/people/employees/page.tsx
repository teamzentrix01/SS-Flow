import { CreateDialog } from "@/components/create-dialog";
import { EmployeeActions, type EmployeeEditValues } from "@/components/employee-actions";
import { EmployeeForm } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listEmployees, listShifts } from "@/lib/queries";

const roles = ["admin", "sales", "purchase", "supervisor", "operator", "qc"] as const;

export default async function EmployeesPage() {
  const session = await requirePage("employee.manage");
  const [employees, shifts] = await Promise.all([listEmployees(session.plantIds), listShifts(session.plantIds)]);
  const admin = session.roles.has("admin");
  const shiftOptions = shifts.map((shift) => ({ id: shift.id, name: shift.name }));
  return (
    <div className="space-y-6">
      <PageHeader title="Employees" detail={admin ? "Plant admin can edit or delete employees. Deleting removes the login. Their jobs stay on the board." : "Create a person, assign an employee ID and password, and choose the role that sets their permissions."} action={<CreateDialog label="Create employee" title="Create employee"><EmployeeForm shifts={shiftOptions} canAssignAdmin={admin} /></CreateDialog>} />
      <SimpleTable
        columns={admin ? ["Employee ID", "Name", "Role", "Skill", "Shift", ""] : ["Employee ID", "Name", "Role", "Skill", "Shift"]}
        rows={employees.map((row) => {
          const roleCode = roles.find((code) => row.user?.userRoles.some((link) => link.role.code === code)) ?? "operator";
          const email = row.user?.email.endsWith("@staff.ssflow.local") ? "" : row.user?.email ?? "";
          const employee: EmployeeEditValues = {
            id: row.id,
            name: row.name,
            code: row.code,
            designation: row.designation ?? "",
            skill: row.skill ?? "",
            shiftId: row.shiftId ?? "",
            email,
            roleCode,
          };
          const cells = [
            row.code,
            row.active ? row.name : `${row.name} · inactive`,
            row.user?.userRoles.map((link) => link.role.name).join(", ") || "No login",
            row.skill ?? "—",
            row.shift?.name ?? "—",
          ];
          return admin ? [...cells, <EmployeeActions key={row.id} employee={employee} shifts={shiftOptions} self={row.userId === session.userId} />] : cells;
        })}
      />
    </div>
  );
}
