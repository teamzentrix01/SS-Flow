import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LeadListFilters } from "@/components/leads/lead-list-filters";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { leadDashboardStats, listLeads } from "@/modules/leads/queries";
import { listEmployees } from "@/lib/queries";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    assigneeId?: string;
    overdue?: string;
    page?: string;
  }>;
}) {
  const session = await requirePage("lead.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const [stats, list, employees] = await Promise.all([
    leadDashboardStats(plantIds),
    listLeads({
      plantIds,
      q: params.q,
      status: params.status,
      source: params.source,
      assigneeId: params.assigneeId,
      overdueFollowUp: params.overdue === "1",
      page,
    }),
    listEmployees(plantIds),
  ]);

  return (
    <DeskListShell
      title="Leads"
      detail="Enquiries from the website and field visits — verify, quote, and convert to sales orders."
      action={
        session.permissions.has("lead.manage") ? (
          <DeskPrimaryCta href="/leads/new" icon={Plus}>
            Create lead
          </DeskPrimaryCta>
        ) : null
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted">Overdue follow-ups</p>
          <p className="mt-1 text-2xl font-semibold">{stats.overdueFollowUps}</p>
        </div>
        {Object.entries(stats.byStatus)
          .slice(0, 3)
          .map(([status, count]) => (
            <div key={status} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase text-muted">{labelFor(status)}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </div>
          ))}
      </section>

      <Suspense fallback={null}>
        <LeadListFilters employees={employees.map((e) => ({ id: e.id, name: e.name }))} />
      </Suspense>

      <DataTable
        columns={[
          {
            id: "number",
            header: "Lead #",
            cell: (row) => row.leadNumber,
          },
          { id: "customer", header: "Customer", cell: (row) => row.customerName },
          { id: "phone", header: "Phone", cell: (row) => row.phone },
          {
            id: "status",
            header: "Status",
            cell: (row) => <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} />,
          },
          { id: "source", header: "Source", cell: (row) => row.source },
          { id: "assignee", header: "Assigned", cell: (row) => row.assignee?.name ?? "—" },
          {
            id: "followup",
            header: "Follow-up",
            cell: (row) =>
              row.nextFollowUpAt ? (
                <span className={row.nextFollowUpAt < new Date() ? "text-amber-700 font-medium" : ""}>
                  {when(row.nextFollowUpAt)}
                </span>
              ) : (
                "—"
              ),
          },
          { id: "items", header: "Lines", cell: (row) => String(row._count.items) },
        ]}
        rows={list.rows}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/leads/${row.id}`}
        emptyTitle="No leads yet"
        emptyDetail="Website enquiries and manual leads will appear here."
      />

      {list.total > list.pageSize ? (
        <p className="text-sm text-muted">
          Page {list.page} · {list.total} total ·{" "}
          {page > 1 ? <Link href={`/leads?page=${page - 1}`}>Previous</Link> : null}{" "}
          {page * list.pageSize < list.total ? <Link href={`/leads?page=${page + 1}`}>Next</Link> : null}
        </p>
      ) : null}
    </DeskListShell>
  );
}
