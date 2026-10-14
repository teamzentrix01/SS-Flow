import Link from "next/link";
import {
  ShopAlert,
  ShopJobActions,
  ShopJobSummary,
  ShopJobTimeline,
} from "@/components/shop-job-ui";
import { getSession } from "@/lib/auth/session";
import { resolveShopJob, requireShopJobView } from "@/lib/shop/job-access";

export default async function ShopJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const { err } = await searchParams;
  const ctx = await resolveShopJob(session, id);
  const job = requireShopJobView(ctx);

  return (
    <div className="space-y-4">
      <Link href="/shop/jobs" className="text-sm text-muted hover:text-accent">
        ← My jobs
      </Link>
      {err === "not_assignee" ? (
        <ShopAlert tone="warning" title="Wrong account">
          This job is assigned to another operator. Sign in with that employee&apos;s account to run it.
        </ShopAlert>
      ) : null}
      {err === "supervisor_view" ? (
        <ShopAlert tone="info" title="Planner account">
          You can view this job, but only the assigned operator can start or submit it.
        </ShopAlert>
      ) : null}
      <ShopJobSummary job={job} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Progress</h2>
        <ShopJobTimeline job={job} />
      </section>
      <ShopJobActions job={job} isAssignee={job.isAssignee} />
    </div>
  );
}
