import { notFound } from "next/navigation";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { leadCanConvert, leadCanVerify } from "@/modules/leads/status";
import { leadDetail } from "@/modules/leads/queries";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("lead.view");
  const plantIds = await plantIdsForSession(session);
  const { id } = await params;
  const lead = await leadDetail(id, plantIds);
  if (!lead) notFound();

  const convertLines = lead.items
    .filter((item: any) => item.productId)
    .map((item: any) => ({
      productId: item.productId!,
      qtyOrdered: item.quantity.toString(),
      unitPrice: item.targetPrice?.toString() ?? item.product?.sellingPrice?.toString() ?? "0",
      uom: item.uom,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.leadNumber}
        detail={`${lead.customerName} · ${lead.phone}`}
        action={<StatusBadge label={labelFor(lead.status)} tone={toneFor(lead.status)} />}
      />

      <dl className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted">Query Date</dt>
          <dd className="font-medium">{lead.queryDate ? when(lead.queryDate) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Contact Person</dt>
          <dd className="font-medium">{lead.contactPerson ?? lead.customerName}</dd>
        </div>
        <div>
          <dt className="text-muted">Designation</dt>
          <dd className="font-medium">{lead.contactDesignation ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Phone</dt>
          <dd className="font-medium">{lead.phone}</dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="font-medium">{lead.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Company</dt>
          <dd className="font-medium">{lead.companyName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Address</dt>
          <dd className="font-medium">{lead.address ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Source</dt>
          <dd className="font-medium">{lead.source}</dd>
        </div>
        <div>
          <dt className="text-muted">Assigned</dt>
          <dd className="font-medium">{lead.assignee?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-muted">Attended By</dt>
          <dd className="font-medium">{lead.attendedBy?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Result</dt>
          <dd className="font-medium">{lead.result ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Result Reason</dt>
          <dd className="font-medium">{lead.resultReason ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Next follow-up</dt>
          <dd className="font-medium">{lead.nextFollowUpAt ? when(lead.nextFollowUpAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Required Delivery Date</dt>
          <dd className="font-medium">{lead.requiredDeliveryDate ? when(lead.requiredDeliveryDate) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Customer master</dt>
          <dd className="font-medium">
            {lead.customer ? `${lead.customer.code} — ${lead.customer.name}` : "—"}
          </dd>
        </div>
        {lead.salesOrder ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">Sales order</dt>
            <dd className="font-medium">
              <TextLink href={`/sales/${lead.salesOrder.id}`}>{lead.salesOrder.number}</TextLink> ·{" "}
              {labelFor(lead.salesOrder.status)}
            </dd>
          </div>
        ) : null}
        {lead.verificationNotes ? (
          <div className="sm:col-span-3">
            <dt className="text-muted">Verification</dt>
            <dd>{lead.verificationNotes}</dd>
            {lead.verifiedBy ? (
              <dd className="text-muted text-xs mt-1">
                {lead.verifiedBy.name} · {lead.verifiedAt ? when(lead.verifiedAt) : ""}
              </dd>
            ) : null}
          </div>
        ) : null}
        {lead.notes ? (
          <div className="sm:col-span-3">
            <dt className="text-muted">Customer Remarks</dt>
            <dd>{lead.notes}</dd>
          </div>
        ) : null}
        {lead.officeRemarks ? (
          <div className="sm:col-span-3">
            <dt className="text-muted">Office Remarks</dt>
            <dd>{lead.officeRemarks}</dd>
          </div>
        ) : null}
      </dl>

      <section className="space-y-2">
        <h2 className="font-semibold">Requested items</h2>
        <SimpleTable
          columns={["Product / description", "Grade", "Size", "Qty", "UOM", "Est. Weight", "Target price"]}
          rows={lead.items.map((item: any) => [
            item.product?.name ?? item.itemDescription ?? "—",
            (item.specifications as any)?.grade ?? "—",
            (item.specifications as any)?.size ?? "—",
            item.quantity.toString(),
            item.uom,
            item.estimatedWeight?.toString() ?? "—",
            item.targetPrice?.toString() ?? "—",
          ])}
        />
      </section>

      {session.permissions.has("lead.manage") || session.permissions.has("lead.verify") || session.permissions.has("lead.convert") ? (
        <LeadDetailActions
          leadId={lead.id}
          status={lead.status}
          canVerify={session.permissions.has("lead.verify") && leadCanVerify(lead.status)}
          canConvert={session.permissions.has("lead.convert") && leadCanConvert(lead.status) && convertLines.length > 0}
          convertDefaults={{ lines: convertLines }}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Activity</h2>
        <SimpleTable
          columns={["When", "Type", "By", "Detail"]}
          rows={lead.activities.map((a: any) => [
            when(a.createdAt),
            a.activityType,
            a.performedBy.name,
            a.description,
          ])}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Status history</h2>
        <SimpleTable
          columns={["When", "From", "To", "By", "Reason"]}
          rows={lead.statusHistory.map((h: any) => [
            when(h.createdAt),
            h.oldStatus ? labelFor(h.oldStatus) : "—",
            labelFor(h.newStatus),
            h.changedBy.name,
            h.reason ?? "—",
          ])}
        />
      </section>
    </div>
  );
}
