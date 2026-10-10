import { MoveForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listBalances, listLocations } from "@/lib/queries";

export default async function AdjustPage() {
  const session = await requirePage("inventory.move");
  const [balances, locations] = await Promise.all([listBalances(session.plantIds), listLocations(session.plantIds)]);
  return (
    <div>
      <PageHeader title="Stock adjustment" detail="A reason is stored on the ledger line." />
      <MoveForm mode="adjust" batches={balances.map((row) => ({ id: row.batchId, label: row.batchNo }))} locations={locations.map((row) => ({ id: row.id, label: `${row.warehouse.code} / ${row.code}` }))} />
    </div>
  );
}
