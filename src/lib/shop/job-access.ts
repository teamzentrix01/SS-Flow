import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { jobDetail } from "@/lib/queries";

export type ShopJobView = NonNullable<Awaited<ReturnType<typeof jobDetail>>>;

export type ShopJobContext =
  | { job: ShopJobView; isAssignee: true }
  | { job: ShopJobView; isAssignee: false; canSupervise: true }
  | { blocked: "login" | "forbidden" | "no_employee" | "not_found" | "not_assignee"; job?: ShopJobView };

export async function resolveShopJob(
  session: SessionUser | null,
  jobId: string,
): Promise<ShopJobContext> {
  if (!session) return { blocked: "login" };
  if (!session.permissions.has("job.execute") && !session.permissions.has("job.assign")) {
    return { blocked: "forbidden" };
  }
  const job = await jobDetail(jobId, session.plantIds);
  if (!job) return { blocked: "not_found" };

  const isAssignee = Boolean(session.employeeId && job.assigneeId === session.employeeId);
  const canSupervise = session.permissions.has("job.assign");

  if (isAssignee) return { job, isAssignee: true };
  if (canSupervise) return { job, isAssignee: false, canSupervise: true };
  return { blocked: "not_assignee", job };
}

export function requireShopJobAssignee(ctx: ShopJobContext): ShopJobView {
  if ("blocked" in ctx) {
    if (ctx.blocked === "login") redirect("/login");
    if (ctx.blocked === "no_employee") redirect("/shop?err=no_employee");
    if (ctx.blocked === "not_found") redirect("/shop/jobs?err=not_found");
    if (ctx.blocked === "not_assignee") redirect(`/shop/jobs/${ctx.job!.id}?err=not_assignee`);
    redirect("/shop?err=forbidden");
  }
  if (!ctx.isAssignee) redirect(`/shop/jobs/${ctx.job.id}?err=supervisor_view`);
  return ctx.job;
}

export function requireShopJobView(ctx: ShopJobContext): ShopJobView & { isAssignee: boolean } {
  if ("blocked" in ctx) {
    if (ctx.blocked === "login") redirect("/login");
    if (ctx.blocked === "not_found") redirect("/shop/jobs?err=not_found");
    if (ctx.blocked === "not_assignee") redirect("/shop/jobs?err=not_assignee");
    if (ctx.blocked === "forbidden") redirect("/shop?err=forbidden");
    redirect("/shop?err=no_employee");
  }
  return { ...ctx.job, isAssignee: ctx.isAssignee };
}
