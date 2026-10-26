import { notFound } from "next/navigation";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { leadCanConvert, leadCanVerify } from "@/modules/leads/status";
import { leadDetail } from "@/modules/leads/queries";
import { listCategories, listSalesOrderProducts } from "@/lib/queries";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("lead.view");
  const plantIds = await plantIdsForSession(session);
  const { id } = await params;
  const lead = await leadDetail(id, plantIds);
  if (!lead) notFound();
  const canConvert = session.permissions.has("lead.convert") && leadCanConvert(lead.status) && lead.items.length > 0;
  const [salesProducts, categories] = await Promise.all([
    canConvert ? listSalesOrderProducts(plantIds) : Promise.resolve([]),
    listCategories(plantIds),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const formatSpecs = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
    return Object.entries(value as Record<string, unknown>).map(([key, val]) => `${key}: ${typeof val === "string" ? val : JSON.stringify(val)}`).join(" · ") || "—";
  };
  const display = (value: unknown) => value == null || value === "" ? "—" : typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value);

  return (
    <div className="space-y-5">
      <PageHeader title={lead.leadNumber} detail={`${lead.source} · Created ${when(lead.createdAt)}`} action={<StatusBadge label={labelFor(lead.status)} tone={toneFor(lead.status)} />} />

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-muted">Customer / company</p><p className="font-medium">{lead.companyName || lead.customer?.name || lead.customerName}</p></div>
        <div><p className="text-muted">Enquiry date / time</p><p className="font-medium">{lead.queryDate ? when(lead.queryDate) : "—"}{lead.queryTime ? ` · ${lead.queryTime.toLocaleTimeString()}` : ""}</p></div>
        <div><p className="text-muted">Contact person</p><p className="font-medium">{lead.contactPerson || lead.customerName}{lead.contactDesignation ? ` · ${lead.contactDesignation}` : ""}</p></div>
        <div><p className="text-muted">Phone / email</p><p className="font-medium">{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</p></div>
        <div><p className="text-muted">Address</p><p className="font-medium">{lead.address || "—"}</p></div>
        <div><p className="text-muted">Assigned salesperson</p><p className="font-medium">{lead.assignee?.name ?? "Unassigned"}</p></div>
        <div><p className="text-muted">Next follow-up</p><p className="font-medium">{lead.nextFollowUpAt ? when(lead.nextFollowUpAt) : "—"}</p></div>
        <div><p className="text-muted">Required delivery</p><p className="font-medium">{lead.requiredDeliveryDate ? when(lead.requiredDeliveryDate) : "—"}</p></div>
        <div><p className="text-muted">Priority / customer record</p><p className="font-medium">{labelFor(lead.priority)}{lead.customer ? ` · ${lead.customer.code} — ${lead.customer.name}` : " · Not linked"}</p></div>
        <div><p className="text-muted">Official follow-up</p><p className="font-medium">{lead.attendedBy?.name || "—"}{lead.result ? ` · ${labelFor(lead.result)}` : ""}</p>{lead.resultReason ? <p>{lead.resultReason}</p> : null}</div>
        {lead.verificationNotes || lead.verifiedAt ? <div className="sm:col-span-2"><p className="text-muted">Verified</p><p className="font-medium">{lead.verifiedBy?.name || "—"}{lead.verifiedAt ? ` · ${when(lead.verifiedAt)}` : ""}</p>{lead.verificationNotes ? <p>{lead.verificationNotes}</p> : null}</div> : null}
        {lead.notes ? <div className="sm:col-span-2"><p className="text-muted">Customer remarks</p><p>{lead.notes}</p></div> : null}
        {lead.officeRemarks ? <div className="sm:col-span-2"><p className="text-muted">Commercial remarks</p><p>{lead.officeRemarks}</p></div> : null}
        {lead.salesOrder ? <div className="sm:col-span-2"><p className="text-muted">Linked Sales Order</p><TextLink href={`/sales/${lead.salesOrder.id}`}>{lead.salesOrder.number}</TextLink> · {labelFor(lead.salesOrder.status)}</div> : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Requested items ({lead.items.length})</h2>
        <SimpleTable columns={["Category", "Material / description", "Grade", "Thickness", "Dimensions", "Quantity", "UOM", "Unit weight", "Other specifications"]} rows={lead.items.map((item) => {
          const specs = item.specifications as Record<string, unknown>;
          const dimensions = [specs?.width ?? item.product?.width?.toString(), specs?.length ?? item.product?.length?.toString(), specs?.size].filter(Boolean).join(" × ") || "—";
          const otherSpecs = Object.fromEntries(Object.entries(specs ?? {}).filter(([key]) => !["grade", "thickness", "width", "length", "size", "categoryId", "categoryName", "unitWeight"].includes(key)));
          const categoryId = typeof specs?.categoryId === "string" ? specs.categoryId : "";
          return [display(item.product?.productCategory?.name ?? specs?.categoryName ?? categoryNames.get(categoryId)), String(specs?.variantDisplayName ?? item.product?.name ?? item.itemDescription ?? "—"), display(specs?.grade ?? item.product?.grade), display(specs?.thickness ?? item.product?.thickness?.toString()), dimensions, item.quantity.toString(), item.uom, display(item.estimatedWeight?.toString() ?? specs?.unitWeight ?? item.product?.weightPerPiece?.toString()), [item.itemDescription, item.notes, formatSpecs(otherSpecs)].filter((part) => part && part !== "—").join(" · ") || "—"];
        })} />
      </section>

      {session.permissions.has("lead.manage") || session.permissions.has("lead.verify") || session.permissions.has("lead.convert") ? <LeadDetailActions
        leadId={lead.id}
        status={lead.status}
        canVerify={session.permissions.has("lead.verify") && leadCanVerify(lead.status)}
        canManage={session.permissions.has("lead.manage")}
        canConvert={canConvert}
        customer={{ name: lead.companyName || lead.customer?.name || lead.customerName, contact: lead.contactPerson || lead.customerName, phone: lead.phone, email: lead.email, address: lead.address, linked: lead.customer?.name ?? null }}
        items={lead.items.map((item) => ({ id: item.id, productId: item.productId, productName: item.product?.name ?? item.itemDescription ?? "Requested item", quantity: item.quantity.toString(), uom: item.uom, targetPrice: item.targetPrice?.toString() ?? "", configuredPrice: item.product?.sellingPrice?.toString() ?? "", specifications: (item.specifications && typeof item.specifications === "object" ? item.specifications : {}) as Record<string, unknown> }))}
        products={salesProducts}
        promisedDate={lead.requiredDeliveryDate?.toISOString().slice(0, 10) ?? ""}
        salesOrder={lead.salesOrder ? { id: lead.salesOrder.id, number: lead.salesOrder.number } : null}
      /> : null}

      <details className="rounded-xl border border-border bg-card p-4" open>
        <summary className="cursor-pointer font-semibold">Activity history ({lead.activities.length})</summary>
        <SimpleTable columns={["When", "Type", "By", "Detail"]} rows={lead.activities.map((activity) => [when(activity.createdAt), labelFor(activity.activityType), activity.performedBy.name, activity.description])} />
      </details>
      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Status history ({lead.statusHistory.length})</summary>
        <SimpleTable columns={["When", "From", "To", "By", "Reason"]} rows={lead.statusHistory.map((history) => [when(history.createdAt), history.oldStatus ? labelFor(history.oldStatus) : "—", labelFor(history.newStatus), history.changedBy.name, history.reason ?? "—"])} />
      </details>
    </div>
  );
}
