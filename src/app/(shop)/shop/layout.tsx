import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { ShopShell } from "@/components/shop-shell";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.permissions.has("job.execute") && !session.permissions.has("qc.decide")) redirect("/dashboard");
  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId }, include: { shift: true } })
    : null;
  const qcOnly = !session.permissions.has("job.execute") && session.permissions.has("qc.decide");
  return <ShopShell name={employee?.name ?? session.name} shift={employee?.shift ? `${employee.shift.name} ${employee.shift.startTime}` : null} qc={qcOnly}>{children}</ShopShell>;
}
