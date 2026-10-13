import { Plus } from "lucide-react";
import { EmployeeRowActions } from "@/components/masters/employee-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listEmployees } from "@/lib/queries";

export default async function EmployeesPage() {
  const session = await requirePage("employee.manage");
  const employees = await listEmployees(session.plantIds);
  const admin = session.roles.has("admin");
  return (
    <DeskListShell
      title="Employees"
      detail={
        admin
          ? "HR records are separate from logins. Use row actions to view, edit, or delete."
          : "Workforce records for your plant."
      }
      action={
        admin ? (
          <DeskPrimaryCta href="/employees/new" icon={Plus}>
            New employee
          </DeskPrimaryCta>
        ) : undefined
      }
    >
      <DataTable
        columns={[
          { id: "code", header: "Employee ID", cell: (row) => row.code },
          {
            id: "name",
            header: "Name",
            cell: (row) => (row.active ? row.name : `${row.name} · inactive`),
          },
          {
            id: "role",
            header: "Role",
            cell: (row) => row.user?.userRoles.map((link) => link.role.name).join(", ") || "No login",
          },
          { id: "skill", header: "Skill", cell: (row) => row.skill ?? "—" },
          { id: "shift", header: "Shift", cell: (row) => row.shift?.name ?? "—" },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[120px] text-right",
            cellClassName: "text-right",
            cell: (row) => (
              <EmployeeRowActions id={row.id} self={row.userId === session.userId} canAdmin={admin} />
            ),
          },
        ]}
        rows={employees}
        getRowKey={(row) => row.id}
        emptyTitle="No employees yet"
        emptyDetail="Add shop-floor staff and optional system logins."
        emptyAction={
          admin ? (
            <DeskPrimaryCta href="/employees/new" icon={Plus}>
              New employee
            </DeskPrimaryCta>
          ) : undefined
        }
      />
    </DeskListShell>
  );
}
