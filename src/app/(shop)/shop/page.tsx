import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopAlert } from "@/components/shop-job-ui";
import { StatusBadge } from "@/components/status-badge";
import { getSession } from "@/lib/auth/session";
import { formatQty, labelFor, toneFor } from "@/lib/format";
import { myJobs } from "@/lib/queries";

export default async function ShopHome({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getSession();
  const { err } = await searchParams;
  if (!session) redirect("/login");
  if (!session.employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <ShopAlert tone="warning" title="No employee profile">
          Your login is not linked to an employee record. Ask an admin to link your user on the Employees page, then
          sign in again.
        </ShopAlert>
      </div>
    );
  }
  const jobs = await myJobs(session.employeeId);
  const assigned = jobs.filter((job) => ["ready", "assigned"].includes(job.status));
  const active = jobs.filter((job) => ["in_progress", "paused"].includes(job.status));
  const done = jobs.filter((job) => ["submitted", "closed"].includes(job.status)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">Your assigned work, running jobs, and completed steps.</p>
      </div>
      {err === "no_employee" ? (
        <ShopAlert tone="warning" title="Operator login required">
          Sign in with the assigned employee&apos;s account to start jobs on the shop floor.
        </ShopAlert>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Assigned</h2>
        {!assigned.length ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">No jobs are assigned to you right now.</p>
        ) : (
          assigned.map((job) => (
            <Link key={job.id} href={job.status === "ready" ? `/shop/jobs/${job.id}/start` : `/shop/jobs/${job.id}`} className="block rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{job.number} · {job.name}</p>
                  <p className="text-sm text-muted">
                    {job.machine?.code ?? "No machine"} · target {formatQty(job.targetQty, job.uom)}
                  </p>
                </div>
                <StatusBadge label={labelFor(job.status)} tone={toneFor(job.status)} />
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">In progress</h2>
        {!active.length ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">No job is running.</p>
        ) : (
          active.map((job) => (
            <Link key={job.id} href={`/shop/jobs/${job.id}/active`} className="block rounded-xl border border-accent/30 bg-accent-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{job.number} · {job.name}</p>
                  <p className="text-sm text-muted">{formatQty(job.goodQty, job.uom)} good so far</p>
                </div>
                <StatusBadge label={labelFor(job.status)} tone={toneFor(job.status)} />
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Done</h2>
        {!done.length ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">No completed jobs yet.</p>
        ) : (
          done.map((job) => (
            <Link key={job.id} href={`/shop/jobs/${job.id}`} className="block rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{job.number} · {job.name}</p>
                  <p className="text-sm text-muted">{formatQty(job.goodQty, job.uom)} good</p>
                </div>
                <StatusBadge label={labelFor(job.status)} tone={toneFor(job.status)} />
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
