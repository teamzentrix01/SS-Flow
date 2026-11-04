import Link from "next/link";
import { PageHeader, SimpleTable } from "@/components/ui";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { labelFor, when } from "@/lib/format";
import { listEmployees } from "@/lib/queries";
import { reportLeadAnalytics } from "@/modules/leads/reports";
import { resolveLeadReportScope } from "@/modules/leads/report-scope";
import { leadSourceLabel, leadStatusLabel } from "@/modules/leads/status";

export default async function LeadReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; assigneeId?: string }>;
}) {
  const session = await requirePage("lead.view");
  const plantIds = await plantIdsForSession(session);
  const params = await searchParams;
  const scope = resolveLeadReportScope(session, params.assigneeId);
  const from = params.from ? new Date(params.from) : undefined;
  const to = params.to ? new Date(params.to) : undefined;
  const toEnd = to ? new Date(to.getTime() + 86400000 - 1) : undefined;

  const [report, employees] = await Promise.all([
    reportLeadAnalytics({
      plantIds,
      assigneeId: scope.assigneeId,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: toEnd && !Number.isNaN(toEnd.getTime()) ? toEnd : undefined,
    }),
    session.permissions.has("lead.manage")
      ? listEmployees(plantIds)
      : Promise.resolve([]),
  ]);

  const canFilterAssignee = session.permissions.has("lead.manage");

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <PageHeader
        title="Lead reports"
        detail="Pipeline funnel, quote conversion, and win/loss analytics. JSON: /api/v1/reports/leads"
        action={
          <Link className="text-sm text-info hover:underline" href="/leads">
            Back to leads
          </Link>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">From</span>
          <input type="date" name="from" defaultValue={params.from ?? ""} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">To</span>
          <input type="date" name="to" defaultValue={params.to ?? ""} className="rounded-lg border border-border px-3 py-2" />
        </label>
        {canFilterAssignee ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium">Assignee</span>
            <select name="assigneeId" defaultValue={params.assigneeId ?? ""} className="rounded-lg border border-border px-3 py-2">
              <option value="">All</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-white">
          Apply
        </button>
        {scope.scopedToSelf ? (
          <p className="text-xs text-muted w-full">Showing your assigned leads only.</p>
        ) : null}
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total leads" value={String(report.totals.leads)} />
        <MetricCard label="Lead → quote" value={`${report.totals.leadToQuoteRate}%`} sub={`${report.totals.quotedLeads} quoted`} />
        <MetricCard label="Quote → order" value={`${report.totals.quoteToOrderRate}%`} sub={`${report.totals.convertedLeads} won`} />
        <MetricCard
          label="Avg first response"
          value={report.totals.avgFirstResponseMinutes != null ? `${report.totals.avgFirstResponseMinutes} min` : "—"}
        />
        <MetricCard
          label="Avg quote → close"
          value={report.totals.avgQuoteToCloseDays != null ? `${report.totals.avgQuoteToCloseDays} days` : "—"}
        />
        <MetricCard label="Order value won" value={`₹${report.totals.orderValueWon.toLocaleString("en-IN")}`} />
        <MetricCard label="Tonnage won (kg)" value={String(report.totals.tonnageKg)} />
        <MetricCard label="Generated" value={when(new Date(report.generatedAt))} />
      </section>

      <SimpleTable
        columns={["Stage", "Count"]}
        rows={Object.entries(report.funnel)
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => [leadStatusLabel(status), String(count)])}
      />

      <SimpleTable
        columns={["Source", "Leads", "Converted", "Rate %"]}
        rows={report.sourceConversion.map((row) => [
          leadSourceLabel(row.source),
          String(row.leads),
          String(row.converted),
          String(row.conversionRate),
        ])}
      />

      <SimpleTable
        columns={["Outcome", "Reason", "Count"]}
        rows={report.lostReasonBreakdown.map((row) => [labelFor(row.status), row.label, String(row.count)])}
      />

      <SimpleTable
        columns={["Assignee", "Total", "Won", "Lost", "Rejected"]}
        rows={report.assigneePerformance.map((row) => [
          row.name,
          String(row.total),
          String(row.converted),
          String(row.lost),
          String(row.rejected),
        ])}
      />

      <SimpleTable
        columns={["Category", "Converted leads", "Order lines"]}
        rows={report.categoryConversion.map((row) => [
          row.categoryName,
          String(row.convertedLeads),
          String(row.lineCount),
        ])}
      />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
