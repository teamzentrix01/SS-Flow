import { jsonData, jsonError, idempotencyKey, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { quotationUpdateSchema } from "@/lib/schemas";
import { getQuotationForSession, updateQuotationDraft } from "@/modules/leads/quotations/commands";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("lead.view");
    const { id } = await ctx.params;
    return jsonData(await getQuotationForSession(session, id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("lead.manage");
    const { id } = await ctx.params;
    const body = await readJson(request, quotationUpdateSchema);
    const key = idempotencyKey(request);
    return jsonData(
      await updateQuotationDraft(session, id, {
        validUntil: body.validUntil,
        paymentTerms: body.paymentTerms,
        deliveryTerms: body.deliveryTerms,
        deliveryTimeDays: body.deliveryTimeDays,
        freightAmount: body.freightAmount,
        loadingCharges: body.loadingCharges,
        gstPercent: body.gstPercent,
        notes: body.notes,
        includesMtc: body.includesMtc,
        thirdPartyInspection: body.thirdPartyInspection,
        items: body.items,
      }, key),
    );
  } catch (error) {
    return jsonError(error);
  }
}
