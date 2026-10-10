import Link from "next/link";
import { requirePage } from "@/lib/access";
import { labelFor } from "@/lib/format";
import { listInspections } from "@/lib/queries";

export default async function ShopQcPage() {
  const session = await requirePage("qc.decide");
  const rows = await listInspections(session.plantIds);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">QC queue</h1>
      {rows.filter((row) => row.status === "pending" || row.status === "hold").map((row) => (
        <Link key={row.id} href={`/shop/qc/${row.id}`} className="block rounded-xl border border-border bg-card p-4">
          <p className="font-medium">{row.kind}</p>
          <p className="text-sm text-muted">{row.batch?.batchNo ?? row.job?.number} · {labelFor(row.status)}</p>
        </Link>
      ))}
    </div>
  );
}
