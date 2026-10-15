import { JobApprovalActions } from "@/components/job-approval-actions";
import { DataTable, DeskListShell } from "@/components/desk";
import { EmptyState, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { kg, labelFor, toneFor, when } from "@/lib/format";
import { listJobsPendingApproval } from "@/lib/queries";

export default async function JobApprovalsPage() {
  const session = await requirePage("job.approve");
  const jobs = await listJobsPendingApproval(session.plantIds);

  return (
    <DeskListShell
      title="Step approvals"
      detail="Operators mark each routing step complete in Shop. Approve here to close the step and unlock the next operation (Forming, Polishing, …). Admins and supervisors can approve."
    >
      {!jobs.length ? (
        <EmptyState title="Nothing waiting" detail="Submitted shop steps will appear here for approval." />
      ) : (
        <DataTable
          columns={[
            { id: "job", header: "Job step", cell: (row) => (
              <div>
                <TextLink href={`/jobs/${row.id}`}>{row.number}</TextLink>
                <p className="text-sm text-muted">
                  Step {row.sequence}: {row.name}
                </p>
              </div>
            ) },
            {
              id: "order",
              header: "Sales order",
              cell: (row) =>
                row.salesOrder ? (
                  <TextLink href={`/sales/${row.salesOrder.id}`}>{row.salesOrder.number}</TextLink>
                ) : (
                  "—"
                ),
            },
            {
              id: "operator",
              header: "Operator",
              cell: (row) => row.assignee?.name ?? "—",
            },
            {
              id: "output",
              header: "Good output",
              cell: (row) => kg(row.goodQty),
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (
                <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} />
              ),
            },
            {
              id: "submitted",
              header: "Submitted",
              cell: (row) => (row.actualEnd ? when(row.actualEnd) : "—"),
            },
            {
              id: "actions",
              header: "",
              stopRowClick: true,
              cell: (row) => <JobApprovalActions jobId={row.id} jobLabel={`${row.number} · ${row.name}`} />,
            },
          ]}
          rows={jobs}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/jobs/${row.id}`}
        />
      )}
    </DeskListShell>
  );
}
