import { notFound, redirect } from "next/navigation";
import { StartForm } from "@/components/forms";
import { getSession } from "@/lib/auth/session";
import { kg } from "@/lib/format";
import { jobDetail } from "@/lib/queries";

export default async function StartPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");
  const { id } = await params;
  const job = await jobDetail(id, session.plantIds, session.employeeId);
  if (!job) notFound();
  if (job.status !== "ready") redirect(`/shop/jobs/${job.id}`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Start checks</h1>
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="font-semibold">{job.number} · {job.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Machine</dt><dd className="font-medium">{job.machine?.code ?? "Not assigned"}</dd></div>
          <div><dt className="text-muted">Batch</dt><dd className="font-medium">{job.batch?.batchNo ?? "Not assigned"}</dd></div>
          <div><dt className="text-muted">Die</dt><dd className="font-medium">{job.die?.code ?? "Not required"}</dd></div>
          <div><dt className="text-muted">Allocated</dt><dd className="font-medium">{kg(job.allocatedQty)}</dd></div>
        </dl>
      </section>
      <StartForm jobId={id} />
    </div>
  );
}
