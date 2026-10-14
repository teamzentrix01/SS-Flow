import { RoleForm } from "@/components/rbac/role-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getRoleDetail, listPermissionCatalog } from "@/modules/rbac/roles";
import { notFound } from "next/navigation";

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("role.manage");
  const { id } = await params;
  const [role, permissions] = await Promise.all([getRoleDetail(id), listPermissionCatalog(session)]);
  if (!role) notFound();
  return (
    <DeskFormPage title={`Edit ${role.name}`} backHref={`/roles/${id}`} backLabel="Back to role">
      {role.isSystem ? (
        <p className="mb-4 text-sm text-muted">
          This is a built-in system role. The slug is fixed; you can adjust permissions and active status where allowed.
        </p>
      ) : null}
      <RoleForm
        permissions={permissions}
        redirectTo={`/roles/${id}`}
        readOnlySlug={role.isSystem}
        initial={{
          id: role.id,
          name: role.name,
          code: role.code,
          description: role.description ?? "",
          isActive: role.isActive,
          permissionCodes: role.permissions.map((p) => p.permission.code),
        }}
      />
    </DeskFormPage>
  );
}
