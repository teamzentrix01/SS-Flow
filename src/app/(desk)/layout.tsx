import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { prisma } from "@/db";
import { getSession } from "@/lib/auth/session";
import { deskNav } from "@/lib/permissions";
import { when } from "@/lib/format";
import { listNotifications, unreadCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.permissions.has("dashboard.view") && session.permissions.has("job.execute")) redirect("/shop");
  const [unread, notes, plant] = await Promise.all([
    unreadCount(session.userId),
    listNotifications(session.userId),
    session.plantIds[0] ? prisma.plant.findUnique({ where: { id: session.plantIds[0] }, select: { name: true } }) : null,
  ]);
  return (
    <DeskShell
      name={session.name}
      email={session.email}
      plantName={plant?.name ?? "Plant"}
      unread={unread}
      notes={notes.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        href: row.href,
        unread: !row.readAt,
        when: when(row.createdAt),
      }))}
      showShop={session.permissions.has("job.execute")}
      items={deskNav.filter((item) => session.permissions.has(item.permission))}
    >
      {children}
    </DeskShell>
  );
}
