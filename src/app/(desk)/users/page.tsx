import { Plus } from "lucide-react";
import { UsersTable } from "@/components/masters/users-table";
import { DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { roleCodesForSelect } from "@/lib/permissions";
import { listDeskUsers } from "@/lib/queries";

export default async function UsersPage() {
  const session = await requirePage("user.manage");
  const users = await listDeskUsers(session.plantIds);
  const roleOptions = roleCodesForSelect(true);
  const rows = users.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userRoles: row.userRoles.map((link) => ({
      role: { code: link.role.code, name: link.role.name },
    })),
    customer: row.customer,
    supplier: row.supplier,
  }));

  return (
    <DeskListShell
      title="Users"
      detail="Create staff, customer, or supplier logins. Employee accounts include HR fields on the same form."
      action={
        <DeskPrimaryCta href="/users/new" icon={Plus}>
          Create user account
        </DeskPrimaryCta>
      }
    >
      <UsersTable users={rows} sessionUserId={session.userId} roleOptions={roleOptions} />
    </DeskListShell>
  );
}
