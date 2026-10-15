import { NextResponse } from "next/server";
import { deliverPendingCustomerEmails } from "@/modules/leads/deliver-customer-email";

/** Retry pending customer emails (cron or manual). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await deliverPendingCustomerEmails(50);
  return NextResponse.json({ data: result });
}
