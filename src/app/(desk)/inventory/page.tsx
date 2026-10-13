import Link from "next/link";
import { BalanceTable } from "@/components/balance-table";
import { MetricCard, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { dashboardData, listBalances } from "@/lib/queries";

const actionClass =
  "inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold transition hover:border-accent hover:bg-accent-soft hover:text-accent";

export default async function InventoryPage() {
  const session = await requirePage("inventory.view");
  const [rows, totals] = await Promise.all([listBalances(session.plantIds), dashboardData(session.plantIds)]);
  const canMove = session.permissions.has("inventory.move");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        detail="Physical stock by batch. Quantities stay in kilograms."
        action={
          <span className="flex flex-wrap gap-2">
            <Link className={actionClass} href="/inventory/ledger">Ledger</Link>
            {canMove ? <Link className={actionClass} href="/inventory/transfer">Transfer</Link> : null}
            {canMove ? <Link className={actionClass} href="/inventory/adjust">Adjust</Link> : null}
          </span>
        }
      />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard tone="lime" label="Available" value={kg(totals.available)} detail="Ready to reserve or issue" />
        <MetricCard tone="periwinkle" label="Reserved" value={kg(totals.reserved)} detail="Held for released orders" />
        <MetricCard tone="coral" label="QC hold" value={kg(totals.hold)} detail="Waiting for an inspection" />
        <MetricCard label="Finished" value={kg(totals.finished)} detail="Passed final QC" />
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="WIP" value={kg(totals.wip)} detail="Issued to a running job" />
        <MetricCard label="Scrap today" value={kg(totals.scrap)} detail="Posted on today's plant totals" />
        <MetricCard label="Batches listed" value={String(rows.length)} detail="Latest stock rows in this table" />
      </section>
      <BalanceTable initial={rows} canPurchase={session.permissions.has("purchase.manage")} />
    </div>
  );
}