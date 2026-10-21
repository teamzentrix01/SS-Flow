import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { listInspections } from "@/lib/queries";

export default async function QualityPage() {
  const session = await requirePage("qc.decide");
  const rows = await listInspections(session.plantIds);
  return (
    <div>
      <PageHeader
        title="Quality"
        detail="Incoming, in-process, and final inspections."
      />
      <SimpleTable
        emptyTitle="No inspections waiting"
        emptyDetail="A goods receipt opens an incoming inspection. A submitted job opens in-process QC."
        columns={["Kind", "Reference", "Status", "Opened"]}
        rowKeys={rows.map((row) => row.id)}
        rowHrefs={rows.map((row) => `/quality/${row.id}`)}
        rows={rows.map((row) => [
          row.kind,
          row.batch?.batchNo ?? row.job?.number ?? "Open",
          <StatusBadge
            key={row.id}
            label={labelFor(row.status)}
            tone={toneFor(row.status)}
          />,
          when(row.createdAt),
        ])}
      />
    </div>
  );
}
