import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReasonForm } from "@/components/forms";
import { getSession } from "@/lib/auth/session";
import { kg } from "@/lib/format";
import { jobDetail } from "@/lib/queries";

export default async function ActiveJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const job = await jobDetail(id, session.plantIds, session.employeeId);
  if (!job) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{job.number}</h1>
      <p className="text-sm text-muted">Good {kg(job.goodQty)} · reject {kg(job.rejectQty)} · scrap {kg(job.scrapQty)}</p>
      <Link className="btn-primary w-full" href={`/shop/jobs/${job.id}/submit`}>Review and submit</Link>
      <ReasonForm url={`/api/v1/jobs/${job.id}/pause`} label={job.status === "paused" ? "Resume" : "Pause"} />
    </div>
  );
}
