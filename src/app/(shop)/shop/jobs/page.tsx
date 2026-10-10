import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { labelFor } from "@/lib/format";
import { myJobs } from "@/lib/queries";

export default async function MyJobsPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");
  const jobs = await myJobs(session.employeeId);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">My jobs</h1>
      {jobs.map((job) => <Link key={job.id} href={`/shop/jobs/${job.id}`} className="block rounded-xl border border-border bg-card p-4"><p className="font-medium">{job.number}</p><p className="text-sm text-muted">{labelFor(job.status)} · {job.batch?.batchNo ?? "No batch"}</p></Link>)}
    </div>
  );
}
