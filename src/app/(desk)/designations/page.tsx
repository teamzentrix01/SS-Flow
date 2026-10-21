import { Plus } from "lucide-react";
import { DesignationRowActions } from "@/components/rbac/designation-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requireAnyPage } from "@/lib/access";
import { listDesignations } from "@/modules/rbac/designations";
import Link from "next/link";

export default async function DesignationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireAnyPage("designation.manage", "employee.manage");
  const { q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
  const { rows, total, pageSize } = await listDesignations(session, session.plantIds, {
    q,
    page,
    pageSize: 25,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <DeskListShell
      title="Designations"
      detail="Job titles for employees (Production Manager, Storekeeper, etc.). Designations describe HR role; system roles control software access."
      action={
        session.permissions.has("designation.manage") ? (
          <DeskPrimaryCta href="/designations/new" icon={Plus}>
            Create designation
          </DeskPrimaryCta>
        ) : null
      }
    >
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or code"
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
          { id: "dept", header: "Department", cell: (row) => row.department?.name ?? "—" },
          { id: "employees", header: "Employees", cell: (row) => row._count.employees },
          { id: "status", header: "Status", cell: (row) => (row.isActive ? "Active" : "Inactive") },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[80px] text-right",
            cellClassName: "text-right",
            stopRowClick: true,
            cell: (row) =>
              session.permissions.has("designation.manage") ? <DesignationRowActions id={row.id} /> : null,
          },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/designations/${row.id}/edit`}
        emptyTitle="No designations yet"
        emptyDetail="Create designations your HR team uses on employee records."
        emptyAction={
          session.permissions.has("designation.manage") ? (
            <DeskPrimaryCta href="/designations/new" icon={Plus}>
              Create designation
            </DeskPrimaryCta>
          ) : null
        }
      />
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={`/designations?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="btn-ghost">
              Previous
            </Link>
          ) : null}
          <span className="text-muted">
            Page {page} of {totalPages} ({total} total)
          </span>
          {page < totalPages ? (
            <Link href={`/designations?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="btn-ghost">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </DeskListShell>
  );
}
