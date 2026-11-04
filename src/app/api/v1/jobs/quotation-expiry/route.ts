import { NextResponse } from "next/server";
import { runQuotationExpiryJob } from "@/modules/leads/quotations/expire-job";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runQuotationExpiryJob();
  return NextResponse.json({ data: result });
}
