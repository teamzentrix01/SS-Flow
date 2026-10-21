import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { when } from "@/lib/format";
import { listNotifications } from "@/lib/queries";
import { MarkNotificationsRead } from "@/components/notification-actions";

export default async function NotificationsPage() {
  const session = await requirePage();
  const rows = await listNotifications(session.userId);
  return (
    <div>
      <PageHeader
        title="Notifications"
        detail={`${rows.filter((row) => !row.readAt).length} unread`}
        action={
          <MarkNotificationsRead disabled={!rows.some((row) => !row.readAt)} />
        }
      />
      <SimpleTable
        columns={["", "When", "Title", "Detail"]}
        rowKeys={rows.map((row) => row.id)}
        rowHrefs={rows.map((row) => row.href ?? undefined)}
        rows={rows.map((row) => [
          row.readAt ? (
            ""
          ) : (
            <span
              key={row.id}
              className="inline-block size-2 rounded-full bg-danger"
              aria-label="Unread"
            />
          ),
          when(row.createdAt),
          row.title,
          row.body,
        ])}
      />
    </div>
  );
}
