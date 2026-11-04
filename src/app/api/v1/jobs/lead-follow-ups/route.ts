import { NextResponse } from "next/server";
import { runLeadFollowUpAlerts } from "@/modules/leads/follow-up-job";

/** Overdue follow-ups & stale leads → in-app notifications (cron or manual). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runLeadFollowUpAlerts();
  return NextResponse.json({ data: result });
}
