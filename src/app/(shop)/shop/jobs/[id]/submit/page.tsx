import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitForm } from "@/components/forms";
import { ShopJobSummary } from "@/components/shop-job-ui";
import { getSession } from "@/lib/auth/session";
import { formatQty } from "@/lib/format";
import { resolveShopJob, requireShopJobAssignee } from "@/lib/shop/job-access";

export default async function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session?.employeeId) redirect("/shop?err=no_employee");
  const ctx = await resolveShopJob(session, id);
  const job = requireShopJobAssignee(ctx);
  if (!["in_progress", "paused"].includes(job.status)) redirect(`/shop/jobs/${job.id}`);

  return (
    <div className="space-y-4">
      <Link href={`/shop/jobs/${job.id}/active`} className="text-sm text-muted hover:text-accent">
        ← Active job
      </Link>
      <h1 className="text-2xl font-semibold">Complete this step</h1>
      <p className="rounded-xl bg-info-soft p-3 text-sm text-info">
        Enter <strong>kilograms</strong> for material in/out on this step. Sales order target for the product is{" "}
        {formatQty(job.targetQty, job.uom)} — that is separate from the kg balance below. A supervisor approves on
        the desk to release the next step (e.g. Forming).
      </p>
      <ShopJobSummary job={job} />
      <SubmitForm jobId={id} defaultConsumed={job.allocatedQty.toString()} />
    </div>
  );
}
