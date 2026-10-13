import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { kg, labelFor } from "@/lib/format";
import { myJobs } from "@/lib/queries";

export default async function ShopHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.permissions.has("job.execute")) redirect("/shop/qc");
  if (!session.employeeId) redirect("/shop/qc");
  const jobs = await myJobs(session.employeeId);
  const today = jobs.filter((job) => !["closed", "cancelled"].includes(job.status));
  const active = today.find((job) => ["in_progress", "paused"].includes(job.status));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
      {active ? <Link href={`/shop/jobs/${active.id}/active`} className="block rounded-2xl border border-accent/30 bg-accent-soft p-4 transition hover:border-accent hover:bg-accent/10"><p className="text-sm text-accent">Active job</p><p className="text-xl font-semibold">{active.number}</p><p>{kg(active.goodQty)} good</p></Link> : <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">No job is running.</p>}
      <div className="space-y-2">
        {today.map((job) => (
          <Link key={job.id} href={`/shop/jobs/${job.id}`} className="block rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{job.number} · {job.name}</p>
            <p className="text-sm text-muted">{job.machine?.code ?? "Machine pending"} · {labelFor(job.status)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
