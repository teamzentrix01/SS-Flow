import { CreateDialog } from "@/components/create-dialog";
import { JobCreateForm } from "@/components/forms";
import { EmptyState, PageHeader, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor } from "@/lib/format";
import { availableBatches, listJobs, listMaterials } from "@/lib/queries";

export default async function JobsPage() {
  const session = await requirePage("job.assign");
  const [jobs, materials, batches] = await Promise.all([
    listJobs(session.plantIds),
    listMaterials(session.plantIds),
    availableBatches(session.plantIds),
  ]);
  const open = jobs.filter((job) => !["closed", "cancelled"].includes(job.status));
  const unassigned = open.filter((job) => !job.assigneeId);
  const employees = [...new Map(open.filter((job) => job.assignee).map((job) => [job.assignee!.id, job.assignee!.name])).entries()];
  return (
    <div className="space-y-6">
      <PageHeader title="Job board" detail="Create a job, then open it to assign the employee, machine, and die." action={<CreateDialog label="Create job" title="Create job"><JobCreateForm products={materials.map((item) => ({ id: item.id, name: item.name }))} batches={batches} /></CreateDialog>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-semibold">Unassigned</h2>
          {unassigned.length === 0 ? (
            open.length === 0
              ? <EmptyState title="No jobs yet" detail="Use Create job. It stays unassigned until you open it and assign an employee." />
              : <EmptyState title="Nothing waiting" detail="Open jobs are already assigned." />
          ) : null}
          {unassigned.map((job) => (
            <TextLink key={job.id} href={`/jobs/${job.id}`}><span className="block rounded-xl border border-border bg-card p-4">{job.number} · {job.name}</span></TextLink>
          ))}
        </section>
        <section className="space-y-4">
          {employees.map(([id, name]) => (
            <div key={id}>
              <h2 className="mb-2 font-semibold">{name}</h2>
              <div className="space-y-2">
                {open.filter((job) => job.assigneeId === id).map((job) => {
                  const locked = job.predecessors.some((link) => link.predecessor.status !== "closed");
                  return (
                    <TextLink key={job.id} href={`/jobs/${job.id}`}>
                      <span className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                        <span>{job.number} · {job.machine?.code ?? "No machine"}{locked ? " · waiting" : ""}</span>
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
    </div>
  );
}
