import { prisma } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { deskGreetingLabel } from "@/lib/desk-greeting";
import { deskNavForSession, isShopEmployee, shopNavForSession } from "@/lib/permissions";
import { formatDeskNavDate, when } from "@/lib/format";
import { listNotifications, listShifts, unreadCount } from "@/lib/queries";

export function isShopFloorOperator(session: SessionUser) {
  return isShopEmployee(session.roles, session.permissions, session.employeeId);
}

export async function loadDeskShellProps(session: SessionUser, mode: "desk" | "shop") {
  const [unread, notes, plant, shifts] = await Promise.all([
    unreadCount(session.userId).catch(() => 0),
    listNotifications(session.userId).catch(() => []),
    session.plantIds[0]
      ? prisma.plant
          .findUnique({ where: { id: session.plantIds[0] }, select: { name: true } })
          .catch(() => null)
      : null,
    listShifts(session.plantIds).catch(() => []),
  ]);
  const shiftLabel =
    shifts.map((shift) => `${shift.name} ${shift.startTime}–${shift.endTime}`).join(" · ") ||
    "No shift configured";
  const items =
    mode === "shop"
      ? shopNavForSession(session.permissions, session.roles)
      : deskNavForSession(session.permissions, session.roles, session.employeeId);

  return {
    greetingLabel: deskGreetingLabel(session.roles, session.name),
    dateLabel: formatDeskNavDate(new Date()),
    userName: session.name,
    email: session.email,
    plantName: plant?.name ?? "Plant",
    shiftLabel,
    unread,
    notes: notes.slice(0, 8).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      href: row.href,
      unread: !row.readAt,
      when: when(row.createdAt),
    })),
    items,
  };
}
