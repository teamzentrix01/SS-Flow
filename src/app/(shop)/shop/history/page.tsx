import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { kg, labelFor } from "@/lib/format";
import { myJobs } from "@/lib/queries";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");
  const jobs = (await myJobs(session.employeeId)).filter((job) => ["closed", "submitted"].includes(job.status));
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Activity</h1>
      {jobs.map((job) => <article key={job.id} className="rounded-xl border border-border bg-card p-4"><p className="font-medium">{job.number}</p><p className="text-sm text-muted">{labelFor(job.status)} · {labelFor(job.approvalStatus)} · {kg(job.goodQty)}</p></article>)}
    </div>
  );
}
