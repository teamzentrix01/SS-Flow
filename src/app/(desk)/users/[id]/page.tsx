import Link from "next/link";
import { Pencil } from "lucide-react";
import { DeskFormPage, DeskSecondaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { when } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { getDeskUser } from "@/lib/queries";
import { notFound } from "next/navigation";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("user.manage");
  const { id } = await params;
  const user = await getDeskUser(id, session.plantIds);
  if (!user) notFound();
  const roles =
    user.userRoles.map((link) => ROLE_LABELS[link.role.code] ?? link.role.name).join(", ") || "—";
  return (
    <DeskFormPage title={user.name} detail={user.email} backHref="/users" backLabel="Back to users">
      <div className="mb-4 flex justify-end">
        <DeskSecondaryCta href={`/users/${id}/edit`} icon={Pencil}>
          Edit
        </DeskSecondaryCta>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Phone</dt>
          <dd className="mt-1 text-sm">{user.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Role</dt>
          <dd className="mt-1 text-sm">{roles}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Linked to</dt>
          <dd className="mt-1 text-sm">
            {user.customer ? (
              <>Customer · {user.customer.code}</>
            ) : user.supplier ? (
              <>Supplier · {user.supplier.code}</>
            ) : user.employee ? (
              <Link href={`/employees/${user.employee.id}`} className="text-[var(--accent)] hover:underline">
                Employee · {user.employee.code}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Plants</dt>
          <dd className="mt-1 text-sm">
            {user.plantAccess.map((row) => row.plant.name).join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Created</dt>
          <dd className="mt-1 text-sm">{when(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Updated</dt>
          <dd className="mt-1 text-sm">{when(user.updatedAt)}</dd>
        </div>
      </dl>
    </DeskFormPage>
  );
}
