import { Plus } from "lucide-react";
import { UserRowActions } from "@/components/masters/user-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { when } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { listDeskUsers } from "@/lib/queries";

export default async function UsersPage() {
  const session = await requirePage("user.manage");
  const users = await listDeskUsers(session.plantIds);
  return (
    <DeskListShell
      title="Users"
      detail="Login accounts with role-based desk navigation. Click a row to open details, or use the action icons."
      action={
        <DeskPrimaryCta href="/users/new" icon={Plus}>
          New user
        </DeskPrimaryCta>
      }
    >
      <DataTable
        columns={[
          { id: "name", header: "Name", cell: (row) => row.name },
          { id: "email", header: "Email", cell: (row) => row.email },
          { id: "phone", header: "Phone", cell: (row) => row.phone ?? "—" },
          {
            id: "roles",
            header: "Role",
            cell: (row) =>
              row.userRoles.map((link) => ROLE_LABELS[link.role.code] ?? link.role.name).join(", ") || "—",
          },
          {
            id: "link",
            header: "Linked to",
            cell: (row) =>
              row.customer ? `Customer · ${row.customer.code}` : row.supplier ? `Supplier · ${row.supplier.code}` : "—",
          },
          {
            id: "created",
            header: "Created",
            cell: (row) => when(row.createdAt),
          },
          {
            id: "updated",
            header: "Updated",
            cell: (row) => when(row.updatedAt),
          },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[120px] text-right",
            cellClassName: "text-right",
            stopRowClick: true,
            cell: (row) => <UserRowActions id={row.id} self={row.id === session.userId} />,
          },
        ]}
        rows={users}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/users/${row.id}`}
        emptyTitle="No users yet"
        emptyDetail="Create admin, manager, employee, customer, or supplier logins."
        emptyAction={
          <DeskPrimaryCta href="/users/new" icon={Plus}>
            New user
          </DeskPrimaryCta>
        }
      />
    </DeskListShell>
  );
}
