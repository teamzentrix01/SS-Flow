import { jsonData, jsonError, idempotencyKey, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { quotationCreateSchema } from "@/lib/schemas";
import { createQuotationDraft } from "@/modules/leads/quotations/commands";
import { listLeadQuotations, serializeQuotationSummary } from "@/modules/leads/quotations/queries";
import { plantIdsForSession } from "@/lib/access";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("lead.view");
    const { id } = await ctx.params;
    const plantIds = await plantIdsForSession(session);
    const rows = await listLeadQuotations(id, plantIds);
    return jsonData(rows.map(serializeQuotationSummary));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("lead.manage");
    const { id } = await ctx.params;
    const body = await readJson(request, quotationCreateSchema);
    const key = idempotencyKey(request);
    const items = body.items?.map((line) => ({
      ...line,
      pricingBasis: line.pricingBasis,
    }));
    return jsonData(
      await createQuotationDraft(
        session,
        id,
        {
          fromQuotationId: body.fromQuotationId,
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
          ...(items?.length ? { items } : {}),
        },
        key,
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
