import Link from "next/link";
import { Pencil } from "lucide-react";
import { EmployeeAccessForm } from "@/components/employee-actions";
import { DeskFormPage, DeskSecondaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getEmployee } from "@/lib/queries";
import { listGrantablePermissions } from "@/modules/rbac/roles";
import { notFound } from "next/navigation";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("employee.manage");
  const { id } = await params;
  const [employee, catalog] = await Promise.all([
    getEmployee(id, session.plantIds),
    listGrantablePermissions(session),
  ]);
  if (!employee) notFound();
  const admin = session.roles.has("admin");
  const roleLabel = employee.user?.userRoles.map((link) => link.role.name).join(", ") || "No login";
  const selectedCodes = employee.user?.userPermissions.length
    ? employee.user.userPermissions.map((row) => row.permission.code)
    : [
        ...new Set(
          employee.user?.userRoles.flatMap((link) => link.role.permissions.map((row) => row.permission.code)) ?? [],
        ),
      ];
  const grantable = catalog.filter((item) => session.permissions.has(item.code) || session.roles.has("admin"));

  return (
    <DeskFormPage title={employee.name} detail={employee.code} backHref="/employees" backLabel="Back to employees">
      {admin ? (
        <div className="mb-4 flex justify-end">
          <DeskSecondaryCta href={`/employees/${id}/edit`} icon={Pencil}>
            Edit employee record
          </DeskSecondaryCta>
        </div>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Designation</dt>
          <dd className="mt-1 text-sm">{employee.designation ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Role / access</dt>
          <dd className="mt-1 text-sm">{roleLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Primary skill</dt>
          <dd className="mt-1 text-sm">{employee.skill ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Shift</dt>
          <dd className="mt-1 text-sm">{employee.shift?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Department</dt>
          <dd className="mt-1 text-sm">{employee.department?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Status</dt>
          <dd className="mt-1 text-sm capitalize">{employee.employmentStatus.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Login</dt>
          <dd className="mt-1 text-sm">{employee.loginEnabled ? employee.user?.email ?? "Enabled" : "Disabled"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Machine</dt>
          <dd className="mt-1 text-sm">
            {employee.assignedMachine ? (
              <Link href={`/machines/${employee.assignedMachine.id}`} className="text-[var(--accent)] hover:underline">
                {employee.assignedMachine.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Software access</h2>
        {employee.user ? (
          <EmployeeAccessForm
            employeeId={employee.id}
            name={employee.name}
            code={employee.code}
            permissions={grantable}
            selectedCodes={selectedCodes}
          />
        ) : (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
            This employee has no login. Create a staff user account first, then return here to choose what they can do.
          </p>
        )}
      </section>
    </DeskFormPage>
  );
}
