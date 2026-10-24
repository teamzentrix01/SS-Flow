import { jsonData, jsonError, readJson } from "@/lib/api";
import { publicLeadEnquirySchema } from "@/lib/schemas";
import { createWebsiteLead } from "@/modules/leads/public-enquiry";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, publicLeadEnquirySchema);
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
    const items = body.items ?? [
      {
        categoryId: undefined,
        quantity: body.quantity ?? "1",
        uom: body.uom,
        productId: body.productId,
        productVariantId: body.productVariantId,
        itemDescription: body.itemDescription,
        specifications: body.specifications,
      },
    ];
    const result = await createWebsiteLead({
      customerName: body.customerName,
      phone: body.phone,
      email: body.email || undefined,
      companyName: body.companyName,
      address: body.address,
      requiredDeliveryDate: body.requiredDeliveryDate,
      commercialRemarks: body.commercialRemarks,
      honeypot: body.website,
      items,
      idempotencyKey,
      clientIp,
    });
    return jsonData(result);
  } catch (error) {
    return jsonError(error);
  }
}
