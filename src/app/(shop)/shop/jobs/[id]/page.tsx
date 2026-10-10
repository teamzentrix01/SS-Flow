import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { kg, labelFor } from "@/lib/format";
import { jobDetail } from "@/lib/queries";

export default async function ShopJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const job = await jobDetail(id, session.plantIds, session.permissions.has("job.assign") ? null : session.employeeId);
  if (!job) notFound();
  const locked = job.predecessors.some((link) => link.predecessor.status !== "closed");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{job.number}</h1>
      <p className="text-sm text-muted">{job.productionOrder.product.name} · {kg(job.targetQty)} · {job.machine?.code ?? "No machine"} · {job.batch?.batchNo ?? "No batch"}</p>
      <p>Status: {labelFor(job.status)}. QC: {labelFor(job.qcStatus)}. Approval: {labelFor(job.approvalStatus)}.</p>
      {locked ? <p className="rounded-xl bg-[#fbf3e4] p-4 text-sm">Locked until {job.predecessors.find((link) => link.predecessor.status !== "closed")?.predecessor.number} is approved.</p> : null}
      {job.instructions ? <p className="text-sm">{job.instructions}</p> : null}
      {job.status === "ready" ? <Link className="btn-primary w-full" href={`/shop/jobs/${job.id}/start`}>Start job</Link> : null}
      {["in_progress", "paused"].includes(job.status) ? <Link className="btn-primary w-full" href={`/shop/jobs/${job.id}/active`}>Open active job</Link> : null}
      {job.approvalStatus === "rejected" ? <p className="text-sm text-danger">Sent back. Update the quantities and submit again.</p> : null}
    </div>
  );
}
