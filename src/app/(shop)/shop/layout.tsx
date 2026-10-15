import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { getSession } from "@/lib/auth/session";
import { loadDeskShellProps } from "@/lib/desk-shell-props";
import { SHOP_QC_SIDEBAR_BLOCKS, SHOP_SIDEBAR_BLOCKS } from "@/lib/desk-nav-ui";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.permissions.has("job.execute") && !session.permissions.has("qc.decide")) redirect("/dashboard");

  const qcOnly = !session.permissions.has("job.execute") && session.permissions.has("qc.decide");
  const shell = await loadDeskShellProps(session, "shop");

  return (
    <DeskShell
      {...shell}
      sidebarBlocks={qcOnly ? SHOP_QC_SIDEBAR_BLOCKS : SHOP_SIDEBAR_BLOCKS}
    >
      {children}
    </DeskShell>
  );
}
