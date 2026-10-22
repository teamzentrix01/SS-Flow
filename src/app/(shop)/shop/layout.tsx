import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { getSession } from "@/lib/auth/session";
import { isShopFloorOperator, loadDeskShellProps } from "@/lib/desk-shell-props";
import { SHOP_QC_SIDEBAR_BLOCKS, sidebarBlocksFromItems } from "@/lib/desk-nav-ui";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !isShopFloorOperator(session) &&
    !session.permissions.has("job.execute") &&
    !session.permissions.has("qc.decide") &&
    !session.permissions.has("material.request")
  ) {
    redirect("/dashboard");
  }

  const qcOnly = !session.permissions.has("job.execute") && session.permissions.has("qc.decide");
  const shell = await loadDeskShellProps(session, "shop");

  return (
    <DeskShell
      {...shell}
      sidebarBlocks={qcOnly ? SHOP_QC_SIDEBAR_BLOCKS : sidebarBlocksFromItems(shell.items)}
    >
      {children}
    </DeskShell>
  );
}
