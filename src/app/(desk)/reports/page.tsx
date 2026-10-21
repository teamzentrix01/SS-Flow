import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { listJobs } from "@/lib/queries";
import {
  reportJobsByStatus,
  reportPendingPurchase,
  reportSalesSummary,
  reportStockSummary,
} from "@/modules/reports/queries";

export default async function ReportsPage() {
  const session = await requirePage("report.view");
  const [stock, sales, purchase, jobsByStatus, jobs] = await Promise.all([
    reportStockSummary(session.plantIds),
    reportSalesSummary(session.plantIds),
    reportPendingPurchase(session.plantIds),
    reportJobsByStatus(session.plantIds),
    listJobs(session.plantIds),
  ]);
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader title="Reports" detail="Server-side aggregates; export via /api/v1/reports/{name}." />
      <SimpleTable columns={["Bucket", "Quantity"]} rows={Object.entries(stock).map(([k, v]) => [k, kg(v)])} />
      <SimpleTable columns={["Sales status", "Count"]} rows={sales.map((row) => [row.status, String(row.count)])} />
      <SimpleTable columns={["Job status", "Count"]} rows={jobsByStatus.map((row) => [row.status, String(row._count)])} />
      <SimpleTable
        columns={["PO", "Supplier", "Material", "Pending"]}
        rowKeys={purchase.slice(0, 30).map((row) => row.orderId)}
        rowHrefs={purchase.slice(0, 30).map((row) => `/purchase-orders/${row.orderId}`)}
        rows={purchase.slice(0, 30).map((row) => [row.po, row.supplier, row.material, row.pending])}
      />
      <SimpleTable
        columns={["Job", "Status", "Good"]}
        rowKeys={jobs.slice(0, 20).map((job) => job.id)}
        rowHrefs={jobs.slice(0, 20).map((job) => `/jobs/${job.id}`)}
        rows={jobs.slice(0, 20).map((job) => [job.number, job.status, kg(job.goodQty)])}
      />
    </div>
  );
}
