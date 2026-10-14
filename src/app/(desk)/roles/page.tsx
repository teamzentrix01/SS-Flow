import { Plus } from "lucide-react";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listRoles } from "@/modules/rbac/roles";
import Link from "next/link";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requirePage("role.manage");
  const { q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
  const { rows, total, pageSize } = await listRoles(session, { q, page, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <DeskListShell
      title="Roles & permissions"
      detail="System roles bundle permissions for login accounts. Assign roles on the Users or Employee screens."
      action={
        <DeskPrimaryCta href="/roles/new" icon={Plus}>
          New role
        </DeskPrimaryCta>
      }
    >
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search roles"
          className="h-11 min-w-[200px] flex-1 rounded-[10px] border border-border px-3 text-sm"
        />
        <button type="submit" className="btn-ghost">
          Search
        </button>
      </form>
      <DataTable
        columns={[
          { id: "code", header: "Code", cell: (row) => row.code },
          { id: "name", header: "Name", cell: (row) => row.name },
          { id: "type", header: "Type", cell: (row) => (row.isSystem ? "System" : "Custom") },
          { id: "perms", header: "Permissions", cell: (row) => row._count.permissions },
          { id: "users", header: "Users", cell: (row) => row._count.users },
          { id: "status", header: "Status", cell: (row) => (row.isActive ? "Active" : "Inactive") },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/roles/${row.id}`}
        emptyTitle="No roles"
        emptyDetail="Seed default roles with prisma db seed, or create a custom role."
        emptyAction={
          <DeskPrimaryCta href="/roles/new" icon={Plus}>
            New role
          </DeskPrimaryCta>
        }
      />
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={`/roles?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="btn-ghost">
              Previous
            </Link>
          ) : null}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/roles?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="btn-ghost">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </DeskListShell>
  );
}
