import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { when } from "@/lib/format";
import { listNotifications } from "@/lib/queries";

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const rows = await listNotifications(session.userId);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      {rows.map((row) => <article key={row.id} className="rounded-xl border border-border bg-card p-4"><p className="font-medium">{row.title}</p><p className="text-sm">{row.body}</p><p className="text-xs text-muted">{when(row.createdAt)}</p></article>)}
    </div>
  );
}
