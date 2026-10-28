import { jsonData, jsonError, readJson } from "@/lib/api";
import { idempotencyKey } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import {
  deliveryDatesSchema,
  leadActivitySchema,
  leadAssignSchema,
  leadConvertSchema,
  leadStatusChangeSchema,
  leadVerifySchema,
} from "@/lib/schemas";
import {
  addLeadActivityManual,
  assignLead,
  changeLeadStatus,
  convertLeadToSalesOrder,
  verifyLead,
  softDeleteLead,
  updateLeadDeliveryDates,
} from "@/modules/leads/commands";

export async function POST(request: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await ctx.params;
    const key = idempotencyKey(request);

    if (action === "delete") {
      const session = await requirePermission("lead.manage");
      return jsonData(await softDeleteLead(session, id, key));
    }

    if (action === "status") {
      const session = await requirePermission("lead.manage");
      const body = await readJson(request, leadStatusChangeSchema);
      return jsonData(await changeLeadStatus(session, id, body, key));
    }
    if (action === "assign") {
      const session = await requirePermission("lead.manage");
      const body = await readJson(request, leadAssignSchema);
      return jsonData(await assignLead(session, id, body, key));
    }
    if (action === "verify") {
      const session = await requirePermission("lead.verify");
      const body = await readJson(request, leadVerifySchema);
      return jsonData(await verifyLead(session, id, body, key));
    }
    if (action === "convert") {
      const session = await requirePermission("lead.convert");
      const body = await readJson(request, leadConvertSchema);
      return jsonData(await convertLeadToSalesOrder(session, id, body, key));
    }
    if (action === "dates" || action === "delivery-dates") {
      const session = await requirePermission("lead.manage");
      const body = await readJson(request, deliveryDatesSchema);
      return jsonData(await updateLeadDeliveryDates(session, id, body, key));
    }
    if (action === "activity") {
      const session = await requirePermission("lead.manage");
      const body = await readJson(request, leadActivitySchema);
      return jsonData(await addLeadActivityManual(session, id, body, key));
    }

    return jsonData(null, 404);
  } catch (error) {
    return jsonError(error);
  }
}
