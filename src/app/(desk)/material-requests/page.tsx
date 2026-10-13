import { IdAction } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { kg, labelFor, toneFor } from "@/lib/format";
import { listMaterialRequests } from "@/lib/queries";

export default async function MaterialRequestsDeskPage() {
  const session = await requirePage("material.request.review");
  const rows = await listMaterialRequests(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Material requests" detail="Review shortages raised from the shop floor." />
      <SimpleTable
        emptyTitle="No requests"
        columns={["Number", "Employee", "Material", "Qty", "Status", ""]}
        rows={rows.map((row) => [
          row.number,
          row.employee.name,
          row.material.name,
          kg(row.qtyRequired),
          <StatusBadge key={row.id} label={labelFor(row.status)} tone={toneFor(row.status)} />,
          row.status === "submitted" ? (
            <IdAction key={`${row.id}-a`} url={`/api/v1/material-requests/${row.id}/decide`} label="Approve" body={{ decision: "approved" }} />
          ) : (
            "—"
          ),
        ])}
      />
    </div>
  );
}
