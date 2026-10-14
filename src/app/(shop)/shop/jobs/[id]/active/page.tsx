import Link from "next/link";
import { redirect } from "next/navigation";
import { ReasonForm } from "@/components/forms";
import { ShopJobSummary } from "@/components/shop-job-ui";
import { getSession } from "@/lib/auth/session";
import { kg, labelFor } from "@/lib/format";
import { resolveShopJob, requireShopJobAssignee } from "@/lib/shop/job-access";

export default async function ActiveJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session?.employeeId) redirect("/shop?err=no_employee");
  const ctx = await resolveShopJob(session, id);
  const job = requireShopJobAssignee(ctx);
  if (!["in_progress", "paused"].includes(job.status)) redirect(`/shop/jobs/${job.id}`);

  return (
    <div className="space-y-4">
      <Link href={`/shop/jobs/${job.id}`} className="text-sm text-muted hover:text-accent">
        ← Job detail
      </Link>
      <h1 className="text-2xl font-semibold">Running · {job.number}</h1>
      <p className="text-sm text-muted">
        Status {labelFor(job.status)} · machine {job.machine?.code ?? "—"}
      </p>
      <section className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Output so far</p>
        <p className="mt-2 text-lg font-semibold">
          Good {kg(job.goodQty)} · reject {kg(job.rejectQty)} · scrap {kg(job.scrapQty)}
        </p>
        <p className="text-sm text-muted">Target {kg(job.targetQty)}</p>
      </section>
      <ShopJobSummary job={job} />
      <Link className="btn-primary w-full text-center" href={`/shop/jobs/${job.id}/submit`}>
        Review and submit
      </Link>
      <ReasonForm
        url={`/api/v1/jobs/${job.id}/pause`}
        label={job.status === "paused" ? "Resume" : "Pause"}
        redirectTo={`/shop/jobs/${job.id}/active`}
      />
    </div>
  );
}
