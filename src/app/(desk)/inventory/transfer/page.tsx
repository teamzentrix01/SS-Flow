import { MoveForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listBalances, listLocations } from "@/lib/queries";

export default async function TransferPage() {
  const session = await requirePage("inventory.move");
  const [balances, locations] = await Promise.all([listBalances(session.plantIds), listLocations(session.plantIds)]);
  return (
    <div>
      <PageHeader title="Transfer stock" detail="Moves available quantity between locations." />
      <MoveForm mode="transfer" batches={balances.map((row) => ({ id: row.batchId, label: row.batchNo }))} locations={locations.map((row) => ({ id: row.id, label: `${row.warehouse.code} / ${row.code}` }))} />
    </div>
  );
}
