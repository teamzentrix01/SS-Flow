import { DeskFormPage } from "@/components/desk";
import { UserEditForm } from "@/components/user-edit-form";
import { requirePage } from "@/lib/access";
import { getDeskUser } from "@/lib/queries";
import { notFound } from "next/navigation";

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("user.manage");
  const { id } = await params;
  const user = await getDeskUser(id, session.plantIds);
  if (!user) notFound();
  const roleCode = user.userRoles[0]?.role.code;
  const editableRole =
    roleCode === "employee" || roleCode === "customer" || roleCode === "supplier" ? roleCode : "employee";
  return (
    <DeskFormPage title="Edit user" backHref={`/users/${id}`} backLabel="Back to user">
      <UserEditForm
        userId={id}
        email={user.email}
        defaultValues={{
          name: user.name,
          phone: user.phone ?? "",
          roleCode: editableRole,
          password: "",
        }}
      />
    </DeskFormPage>
  );
}
