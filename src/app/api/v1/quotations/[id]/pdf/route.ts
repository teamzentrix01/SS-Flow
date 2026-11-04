import { NextResponse } from "next/server";
import { requirePermission, plantIdsForSession } from "@/lib/access";
import { jsonError } from "@/lib/api";
import { quotationDetail } from "@/modules/leads/quotations/queries";
import { quotationDocumentFilename, renderQuotationHtml } from "@/modules/leads/quotations/pdf-html";
import { AppError } from "@/lib/errors";

const ARCHIVED_STATUSES = new Set(["SENT", "ACCEPTED", "EXPIRED", "SUPERSEDED"]);

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("lead.view");
    const { id } = await ctx.params;
    const plantIds = await plantIdsForSession(session);
    const quote = await quotationDetail(id, plantIds);
    if (!quote) throw new AppError(404, "NOT_FOUND", "Quotation not found.");

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";

    const archived = ARCHIVED_STATUSES.has(quote.status.toUpperCase());
    const html = renderQuotationHtml(quote, {
      archived,
      sentAt: quote.sentAt ?? undefined,
      sentVia: quote.sentVia,
    });

    const filename = quotationDocumentFilename(quote.quotationNumber, quote.version);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
