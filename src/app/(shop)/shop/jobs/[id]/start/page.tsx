import Link from "next/link";
import { redirect } from "next/navigation";
import { StartForm } from "@/components/forms";
import { ShopPrepareMaterial } from "@/components/shop-prepare-material";
import { ShopJobSummary, ShopStartBlockers } from "@/components/shop-job-ui";
import { getSession } from "@/lib/auth/session";
import { canStartJob } from "@/lib/domain/jobs";
import { resolveShopJob, requireShopJobAssignee } from "@/lib/shop/job-access";

export default async function StartPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session?.employeeId) redirect("/shop?err=no_employee");
  const ctx = await resolveShopJob(session, id);
  const job = requireShopJobAssignee(ctx);
  if (job.status !== "ready") redirect(`/shop/jobs/${job.id}`);

  const blocked = canStartJob({
    status: job.status,
    approvalStatus: job.approvalStatus,
    assigneeId: job.assigneeId,
    actorEmployeeId: session.employeeId,
    predecessors: job.predecessors.map((link) => link.predecessor.status),
    machineBlocked: job.machine?.status === "down",
  });
  const readyToStart =
    !blocked && Boolean(job.machineId) && Boolean(job.batchId) && job.machine?.status !== "down";

  return (
    <div className="space-y-4">
      <Link href={`/shop/jobs/${job.id}`} className="text-sm text-muted hover:text-accent">
        ← Back to job
      </Link>
      <h1 className="text-2xl font-semibold">Start checks</h1>
      <p className="text-sm text-muted">
        Confirm machine, material, and die match the job card before issuing stock to the line.
      </p>
      <ShopJobSummary job={job} />
      {!readyToStart ? (
        <>
          <ShopStartBlockers job={job} />
          {!job.batchId && job.machineId ? (
            <ShopPrepareMaterial jobId={job.id} redirectTo={`/shop/jobs/${job.id}/start`} />
          ) : null}
        </>
      ) : null}
      {readyToStart ? (
        <StartForm
          jobId={id}
          readingRequired={job.machine?.readingRequired ?? false}
          machineLabel={job.machine ? `${job.machine.code} · ${job.machine.name}` : undefined}
          dieLabel={job.die?.code}
          batchLabel={job.batch?.batchNo}
        />
      ) : null}
    </div>
  );
}
