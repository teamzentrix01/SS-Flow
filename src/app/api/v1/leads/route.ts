import { createLeadManual } from "@/modules/leads/commands";
import { action } from "@/lib/action";
import { leadCreateSchema } from "@/lib/schemas";
import { requirePermission, plantIdsForSession } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { listLeads } from "@/modules/leads/queries";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("lead.view");
    const plantIds = await plantIdsForSession(session);
    const { searchParams } = new URL(request.url);
    const result = await listLeads({
      plantIds,
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      assigneeId: searchParams.get("assigneeId") ?? undefined,
      overdueFollowUp: searchParams.get("overdue") === "1",
      unconfirmedPromised: searchParams.get("unconfirmed") === "1",
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    });
    return jsonData(result);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("lead.manage", leadCreateSchema, (session, body, key) =>
  createLeadManual(session, { ...body, email: body.email || undefined }, key),
);
