import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
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
        rows={rows.map((row) => [
          row.kind,
          <TextLink key={row.id} href={`/quality/${row.id}`}>
            {row.batch?.batchNo ?? row.job?.number ?? "Open"}
          </TextLink>,
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
