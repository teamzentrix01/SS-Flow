import { jsonData, jsonError, idempotencyKey, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { quotationSendSchema } from "@/lib/schemas";
import {
  approveQuotation,
  reviseQuotation,
  sendQuotation,
} from "@/modules/leads/quotations/commands";

export async function POST(request: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await ctx.params;
    const key = idempotencyKey(request);

    if (action === "send") {
      const session = await requirePermission("lead.manage");
      const body = await readJson(request, quotationSendSchema);
      return jsonData(await sendQuotation(session, id, body, key));
    }
    if (action === "revise") {
      const session = await requirePermission("lead.manage");
      return jsonData(await reviseQuotation(session, id, key));
    }
    if (action === "approve") {
      const session = await requirePermission("quotation.approve");
      return jsonData(await approveQuotation(session, id, key));
    }

    return jsonData(null, 404);
  } catch (error) {
    return jsonError(error);
  }
}
