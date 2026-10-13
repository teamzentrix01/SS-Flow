import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { prisma } from "@/db";
import { getSession } from "@/lib/auth/session";
import { deskGreetingLabel } from "@/lib/desk-greeting";
import { deskNavForSession } from "@/lib/permissions";
import { formatDeskNavDate, when } from "@/lib/format";
import { listNotifications, listShifts, unreadCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.permissions.has("dashboard.view") && session.permissions.has("job.execute")) redirect("/shop");
  const [unread, notes, plant, shifts] = await Promise.all([
    unreadCount(session.userId),
    listNotifications(session.userId),
    session.plantIds[0] ? prisma.plant.findUnique({ where: { id: session.plantIds[0] }, select: { name: true } }) : null,
    listShifts(session.plantIds),
  ]);
  const shiftLabel =
    shifts.map((shift) => `${shift.name} ${shift.startTime}–${shift.endTime}`).join(" · ") ||
    "No shift configured";
  return (
    <DeskShell
      greetingLabel={deskGreetingLabel(session.roles, session.name)}
      dateLabel={formatDeskNavDate(new Date())}
      userName={session.name}
      email={session.email}
      plantName={plant?.name ?? "Plant"}
      shiftLabel={shiftLabel}
      unread={unread}
      notes={notes.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        href: row.href,
        unread: !row.readAt,
        when: when(row.createdAt),
      }))}
      items={deskNavForSession(session.permissions, session.roles)}
    >
      {children}
    </DeskShell>
  );
}
