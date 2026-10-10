import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { dashboardData, listJobs } from "@/lib/queries";

export default async function ReportsPage() {
  const session = await requirePage("report.view");
  const [data, jobs] = await Promise.all([dashboardData(session.plantIds), listJobs(session.plantIds)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" detail="Live operational totals. Heavy file exports stay out of the request." />
      <SimpleTable columns={["Bucket", "Quantity"]} rows={[["Available", kg(data.available)], ["Reserved", kg(data.reserved)], ["QC hold", kg(data.hold)], ["WIP", kg(data.wip)], ["Finished", kg(data.finished)], ["Scrap today", kg(data.scrap)]]} />
      <SimpleTable columns={["Job", "Status", "Good"]} rows={jobs.slice(0, 20).map((job) => [job.number, job.status, kg(job.goodQty)])} />
    </div>
  );
}
