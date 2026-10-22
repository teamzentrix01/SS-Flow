import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopAlert } from "@/components/shop-job-ui";
import { StatusBadge } from "@/components/status-badge";
import { getSession } from "@/lib/auth/session";
import { formatQty, labelFor, toneFor } from "@/lib/format";
import { myJobs } from "@/lib/queries";

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getSession();
  const { err } = await searchParams;
  if (!session) redirect("/login");
  if (!session.employeeId) redirect("/shop?err=no_employee");
  const jobs = await myJobs(session.employeeId);
  const open = jobs.filter((job) => !["closed", "cancelled"].includes(job.status));
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <p className="text-sm text-muted">Open a ready job to start work on the line.</p>
      {err === "not_found" ? (
        <ShopAlert tone="warning" title="Job not available">
          That job was not found or is not assigned to you.
        </ShopAlert>
      ) : null}
      {err === "not_assignee" ? (
        <ShopAlert tone="warning" title="Not your job">
          Open a job from this list — only jobs assigned to you appear here.
        </ShopAlert>
      ) : null}
      {!open.length ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">No open jobs on your queue.</p>
      ) : null}
      {open.map((job) => (
        <Link key={job.id} href={`/shop/jobs/${job.id}`} className="block rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {job.number} · {job.name}
              </p>
              <p className="text-sm text-muted">
                {job.machine?.code ?? "No machine"} · target {formatQty(job.targetQty, job.uom)} ·{" "}
                {job.batch?.batchNo ?? "No batch"}
              </p>
            </div>
            <StatusBadge label={labelFor(job.status)} tone={toneFor(job.status)} />
          </div>
        </Link>
      ))}
    </div>
  );
}
