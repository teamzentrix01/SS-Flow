import { UserCreateForm } from "@/components/user-create-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";

export default async function NewUserPage() {
  await requirePage("user.manage");
  return (
    <DeskFormPage title="New user" backHref="/users" backLabel="Back to users">
      <UserCreateForm />
    </DeskFormPage>
  );
}
