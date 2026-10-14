import { RoleForm } from "@/components/rbac/role-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listPermissionCatalog } from "@/modules/rbac/roles";

export default async function NewRolePage() {
  const session = await requirePage("role.manage");
  const permissions = await listPermissionCatalog(session);
  return (
    <DeskFormPage title="Create role" backHref="/roles" backLabel="Back to roles">
      <RoleForm permissions={permissions} redirectTo="/roles" />
    </DeskFormPage>
  );
}
