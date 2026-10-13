import { Plus } from "lucide-react";
import { JobRowActions } from "@/components/masters/job-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { EmptyState, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor } from "@/lib/format";
import { listJobs } from "@/lib/queries";

export default async function JobsPage() {
  const session = await requirePage("job.assign");
  const jobs = await listJobs(session.plantIds);
  const open = jobs.filter((job) => !["closed", "cancelled"].includes(job.status));
  const unassigned = open.filter((job) => !job.assigneeId);
  const employees = [
    ...new Map(
      open.filter((job) => job.assignee).map((job) => [job.assignee!.id, job.assignee!.name]),
    ).entries(),
  ];
  return (
    <DeskListShell
      title="Job board"
      detail="All jobs in one table. Use the board below for unassigned and by-operator views."
      action={
        <DeskPrimaryCta href="/jobs/new" icon={Plus}>
          New job
        </DeskPrimaryCta>
      }
    >
      <DataTable
        columns={[
          { id: "number", header: "Job #", cell: (row) => row.number },
          {
            id: "name",
            header: "Name",
            cell: (row) => (
              <TextLink href={`/jobs/${row.id}`}>{row.name}</TextLink>
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <StatusBadge label={labelFor(row.status)} tone={toneFor(row.status)} />
            ),
          },
          {
            id: "assignee",
            header: "Assignee",
            cell: (row) => row.assignee?.name ?? "—",
          },
          {
            id: "machine",
            header: "Machine",
            cell: (row) => row.machine?.code ?? "—",
          },
          {
            id: "actions",
            header: "",
            headerClassName: "w-[72px] text-right",
            cellClassName: "text-right",
            cell: (row) => <JobRowActions id={row.id} />,
          },
        ]}
        rows={jobs}
        getRowKey={(row) => row.id}
        emptyTitle="No jobs yet"
        emptyDetail="Create a job, then assign employee, machine, and die from the job detail page."
        emptyAction={
          <DeskPrimaryCta href="/jobs/new" icon={Plus}>
            New job
          </DeskPrimaryCta>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Unassigned</h2>
          {unassigned.length === 0 ? (
            open.length === 0 ? (
              <EmptyState title="No open jobs" detail="Create a job to get started." />
            ) : (
              <EmptyState title="Nothing waiting" detail="Open jobs are already assigned." />
            )
          ) : null}
          {unassigned.map((job) => (
            <TextLink key={job.id} href={`/jobs/${job.id}`}>
              <span className="block rounded-xl border border-border bg-card p-4">
                {job.number} · {job.name}
              </span>
            </TextLink>
          ))}
        </section>
        <section className="space-y-4">
          {employees.map(([id, name]) => (
            <div key={id}>
              <h2 className="mb-2 text-base font-semibold">{name}</h2>
              <div className="space-y-2">
                {open
                  .filter((job) => job.assigneeId === id)
                  .map((job) => {
                    const locked = job.predecessors.some(
                      (link) => link.predecessor.status !== "closed",
                    );
                    return (
                      <TextLink key={job.id} href={`/jobs/${job.id}`}>
                        <span className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                          <span>
                            {job.number} · {job.machine?.code ?? "No machine"}
                            {locked ? " · waiting" : ""}
                          </span>
                          <StatusBadge label={labelFor(job.status)} tone={toneFor(job.status)} />
                        </span>
                      </TextLink>
                    );
                  })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </DeskListShell>
  );
}
