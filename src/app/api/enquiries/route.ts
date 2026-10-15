import { NextResponse } from "next/server";
import { createWebsiteLead } from "@/modules/leads/public-enquiry";
import { siteEnquiryToLeadInput, type SiteEnquiryInput } from "@/lib/site-enquiry";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as SiteEnquiryInput | null;
    if (!body?.name?.trim() || !body?.phone?.trim()) {
      return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
    }

    const mapped = siteEnquiryToLeadInput(body);
    if (mapped.customerName.length < 2) {
      return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }
    if (mapped.phone.length < 8) {
      return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;

    const result = await createWebsiteLead({
      plantCode: mapped.plantCode,
      customerName: mapped.customerName,
      phone: mapped.phone,
      email: mapped.email,
      companyName: mapped.companyName,
      honeypot: mapped.honeypot,
      idempotencyKey,
      clientIp,
      items: [
        {
          quantity: "1",
          uom: "PCS",
          itemDescription: mapped.itemDescription,
        },
      ],
    });

    return NextResponse.json({ ok: true, reference: result.reference });
  } catch (error) {
    const res = jsonError(error);
    const payload = (await res.json()) as { error?: { message?: string } };
    return NextResponse.json(
      { error: payload.error?.message ?? "Could not submit enquiry." },
      { status: res.status },
    );
  }
}
