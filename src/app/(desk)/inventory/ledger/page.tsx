import Link from "next/link";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { when } from "@/lib/format";
import { listMovements } from "@/lib/queries";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const session = await requirePage("inventory.view");
  const { cursor } = await searchParams;
  const page = await listMovements(session.plantIds, cursor);
  return (
    <div>
      <PageHeader title="Stock ledger" detail="Append-only movements. Quantities are never edited in place." />
      <SimpleTable columns={["When", "Batch", "Type", "Qty", "Reason"]} rows={page.rows.map((row) => [when(row.when), row.batch, row.type, row.qty, row.reason])} emptyTitle="No movements yet" emptyDetail="Receipts, issues, scrap, and dispatch each add a line here. Stock balances are the result of these lines." />
      {page.nextCursor ? <Link className="mt-4 inline-block text-sm font-medium text-steel" href={`/inventory/ledger?cursor=${page.nextCursor}`}>Next page</Link> : null}
    </div>
  );
}
