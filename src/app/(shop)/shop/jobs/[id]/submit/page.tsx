import { notFound, redirect } from "next/navigation";
import { SubmitForm } from "@/components/forms";
import { getSession } from "@/lib/auth/session";
import { kg } from "@/lib/format";
import { jobDetail } from "@/lib/queries";

export default async function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");
  const { id } = await params;
  const job = await jobDetail(id, session.plantIds, session.employeeId);
  if (!job) notFound();
  if (!["in_progress", "paused"].includes(job.status)) redirect(`/shop/jobs/${job.id}`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Submit job</h1>
      <p className="rounded-xl bg-info-soft p-3 text-sm text-info">Reconcile the output with the material consumed. Target: {kg(job.targetQty)}.</p>
      <SubmitForm jobId={id} />
    </div>
  );
}
