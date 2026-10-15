import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { getSession } from "@/lib/auth/session";
import { isShopFloorOperator, loadDeskShellProps } from "@/lib/desk-shell-props";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (isShopFloorOperator(session)) redirect("/shop");
  if (!session.permissions.has("dashboard.view") && session.permissions.has("job.execute")) redirect("/shop");
  const shell = await loadDeskShellProps(session, "desk");
  return <DeskShell {...shell}>{children}</DeskShell>;
}
