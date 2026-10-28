import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";
import {
  CalloutBanner,
  DataTable,
  DetailActionLink,
  FieldGrid,
  KeyValueList,
  PageHeader,
  ProgressStepper,
  SectionCard,
  SpecGrid,
  StatusBadge,
  StatusHistoryList,
  Timeline,
  type WorkflowStep,
} from "@/components/detail";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { labelFor, when } from "@/lib/format";
import { leadCanConvert, leadCanVerify } from "@/modules/leads/status";
import { leadDetail } from "@/modules/leads/queries";
import { listCategories, listSalesOrderProducts } from "@/lib/queries";

type SpecRecord = Record<string, unknown>;

function parseSpecifications(value: unknown): SpecRecord {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as SpecRecord;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as SpecRecord;
  } catch {
    // Older leads can contain a plain key:value specification string.
  }
  return Object.fromEntries(
    value
      .split(/[;\n\u00b7]/)
      .map((part) => {
        const separator = part.indexOf(":");
        return separator < 0
          ? [part.trim(), ""]
          : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
      })
      .filter(([key]) => key),
  );
}

function cleanValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return (
      value
        .map(cleanValue)
        .filter((part) => part !== "—")
        .join(", ") || "—"
    );
  return (
    Object.entries(value as SpecRecord)
      .map(([key, part]) => `${labelFor(key)}: ${cleanValue(part)}`)
      .join(" · ") || "—"
  );
}

function specLabel(key: string) {
  const labels: Record<string, string> = {
    designForm: "Design form",
    design_form: "Design form",
    dimensions: "Dimensions",
    drawingReference: "Drawing reference",
    drawing_reference: "Drawing reference",
    productSku: "Product SKU",
    sku: "Product SKU",
    compatibleUtensilType: "Compatible utensil type",
    productName: "Product name",
    grade: "Grade",
    thickness: "Thickness",
    finish: "Finish",
    width: "Width",
    length: "Length",
    diameter: "Diameter",
    size: "Size",
    unitWeight: "Unit weight",
    weightPerPiece: "Weight per piece",
    categoryName: "Category",
    notes: "Notes",
  };
  return labels[key] ?? labelFor(key);
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePage("lead.view");
  const plantIds = await plantIdsForSession(session);
  const { id } = await params;
  const lead = await leadDetail(id, plantIds);
  if (!lead) notFound();

  const canConvert =
    session.permissions.has("lead.convert") &&
    leadCanConvert(lead.status) &&
    lead.items.length > 0;
  const [salesProducts, categories] = await Promise.all([
    canConvert ? listSalesOrderProducts(plantIds) : Promise.resolve([]),
    listCategories(plantIds),
  ]);
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const workflow: WorkflowStep[] = [];
  for (const history of [...lead.statusHistory].reverse()) {
    if (!workflow.some((step) => step.name === history.newStatus)) {
      workflow.push({
        name: history.newStatus,
        date: history.createdAt,
        note: history.changedBy.name,
      });
    }
  }
  if (!workflow.length)
    workflow.push({
      name: lead.status,
      date: lead.createdAt,
      note: "Enquiry received",
    });

  const rows = lead.items.map((item) => {
    const specs = parseSpecifications(item.specifications);
    const categoryId =
      typeof specs.categoryId === "string" ? specs.categoryId : "";
    const dimensions =
      [
        specs.width ?? item.product?.width?.toString(),
        specs.length ?? item.product?.length?.toString(),
        specs.size,
      ]
        .filter((part) => part != null && part !== "")
        .map(cleanValue)
        .join(" × ") || "—";
    return {
      category:
        item.product?.productCategory?.name ??
        (typeof specs.categoryName === "string"
          ? specs.categoryName
          : categoryNames.get(categoryId)) ??
        "—",
      description: String(
        specs.variantDisplayName ??
          item.product?.name ??
          item.itemDescription ??
          "—",
      ),
      grade: cleanValue(specs.grade ?? item.product?.grade),
      thickness: cleanValue(
        specs.thickness ?? item.product?.thickness?.toString(),
      ),
      dimensions,
      quantity: item.quantity.toString(),
      uom: item.uom,
      weight: cleanValue(
        item.estimatedWeight?.toString() ??
          specs.unitWeight ??
          item.product?.weightPerPiece?.toString(),
      ),
      specs,
      sku: item.productVariant?.sku ?? item.product?.code ?? specs.sku,
    };
  });
  const tableRows = rows.map((row) => ({
    category: row.category,
    description: row.description,
    grade: row.grade,
    thickness: row.thickness,
    dimensions: row.dimensions,
    quantity: row.quantity,
    uom: row.uom,
    weight: row.weight,
  }));

  const sourceText = labelFor(lead.source);
  const contactName = lead.contactPerson || lead.customerName;
  const companyName =
    lead.companyName || lead.customer?.name || lead.customerName;
  const statusHistory = lead.statusHistory.map((history) => ({
    from: history.oldStatus,
    to: history.newStatus,
    reason: history.reason,
    date: history.createdAt,
    user: history.changedBy.name,
  }));

  return (
    <div className="mx-auto max-w-[1280px] space-y-[18px] rounded-xl bg-[var(--detail-bg)] p-3 sm:p-5">
      <PageHeader
        breadcrumb={`Leads / ${lead.leadNumber}`}
        title={lead.leadNumber}
        status={lead.status}
        source={lead.source}
        meta={`Created ${when(lead.createdAt)} · Enquiry submitted from ${sourceText.toLowerCase()}`}
        action={
          lead.salesOrder ? (
            <DetailActionLink href={`/sales/${lead.salesOrder.id}`}>
              View sales order {lead.salesOrder.number}
            </DetailActionLink>
          ) : undefined
        }
      />

      <ProgressStepper steps={workflow} />

      <div className="grid min-w-0 gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="min-w-0 space-y-[18px]">
          <SectionCard title="Customer & contact">
            <FieldGrid
              fields={[
                { label: "Customer / company", value: companyName },
                {
                  label: "Contact person",
                  value: contactName,
                  subline: lead.contactDesignation || undefined,
                },
                {
                  label: "Phone / email",
                  value: lead.phone,
                  subline: lead.email || undefined,
                },
                {
                  label: "Customer record",
                  value: lead.customer
                    ? `${lead.customer.code} · ${lead.customer.name}`
                    : "—",
                  subline: labelFor(lead.priority),
                },
                { label: "Address", value: lead.address || "—" },
                {
                  label: "Enquiry date / time",
                  value: lead.queryDate
                    ? `${when(lead.queryDate)}${lead.queryTime ? ` · ${lead.queryTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}`
                    : "—",
                },
              ]}
            />
            {lead.notes || lead.officeRemarks ? (
              <div className="mt-3 grid gap-3 border-t border-[var(--detail-border)] pt-3 sm:grid-cols-2">
                {lead.notes ? (
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--detail-muted)]">
                      Customer remarks
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                      {lead.notes}
                    </p>
                  </div>
                ) : null}
                {lead.officeRemarks ? (
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--detail-muted)]">
                      Commercial remarks
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                      {lead.officeRemarks}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Requested items" count={lead.items.length}>
            <DataTable
              columns={[
                { key: "category", label: "Category" },
                { key: "description", label: "Material / description" },
                { key: "grade", label: "Grade" },
                { key: "thickness", label: "Thickness" },
                { key: "dimensions", label: "Dimensions" },
                { key: "quantity", label: "Qty", align: "right" },
                { key: "uom", label: "UOM" },
                { key: "weight", label: "Unit wt.", align: "right" },
              ]}
              rows={tableRows}
            />
            <div className="mt-3 space-y-2">
              <h3 className="px-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--detail-muted)]">
                Specifications
              </h3>
              {rows.map((row, index) => {
                const specs = row.specs;
                const picked: {
                  label: string;
                  value: React.ReactNode;
                  wide?: boolean;
                }[] = [];
                const add = (label: string, value: unknown, wide = false) => {
                  if (value != null && value !== "")
                    picked.push({ label, value: cleanValue(value), wide });
                };
                add(
                  "Design form",
                  specs.designForm ?? specs.design_form ?? specs.form,
                );
                add("Dimensions", specs.dimensions ?? row.dimensions);
                add(
                  "Drawing reference",
                  specs.drawingReference ?? specs.drawing_reference,
                );
                add("Product SKU", row.sku, true);
                add(
                  "Compatible utensil type",
                  specs.compatibleUtensilType ?? specs.compatible_utensil_type,
                );
                add(
                  "Product name",
                  specs.productName ?? specs.product_name ?? row.description,
                  true,
                );
                const omitted = new Set([
                  "designForm",
                  "design_form",
                  "form",
                  "dimensions",
                  "drawingReference",
                  "drawing_reference",
                  "productSku",
                  "sku",
                  "compatibleUtensilType",
                  "compatible_utensil_type",
                  "productName",
                  "product_name",
                  "variantDisplayName",
                  "categoryId",
                  "categoryName",
                  "notes",
                  "width",
                  "length",
                  "size",
                ]);
                for (const [key, value] of Object.entries(specs))
                  if (!omitted.has(key) && value != null && value !== "")
                    add(
                      specLabel(key),
                      value,
                      key.toLowerCase().includes("sku"),
                    );
                return (
                  <div key={index} className="space-y-1.5">
                    {lead.items.length > 1 ? (
                      <h4 className="text-[9px] font-semibold text-[var(--ink-muted)]">
                        Item {index + 1}: {row.description}
                      </h4>
                    ) : null}
                    <SpecGrid values={picked} />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {lead.salesOrder ? (
            <CalloutBanner
              title="Converted to sales order"
              description="This lead has been turned into an order and is now tracked there."
              action={
                <DetailActionLink href={`/sales/${lead.salesOrder.id}`}>
                  View Sales Order {lead.salesOrder.number}
                </DetailActionLink>
              }
            />
          ) : null}

          {session.permissions.has("lead.manage") ||
          session.permissions.has("lead.verify") ||
          session.permissions.has("lead.convert") ? (
            <LeadDetailActions
              leadId={lead.id}
              status={lead.status}
              canVerify={
                session.permissions.has("lead.verify") &&
                leadCanVerify(lead.status)
              }
              canManage={session.permissions.has("lead.manage")}
              canConvert={canConvert}
              customer={{
                name: companyName,
                contact: contactName,
                phone: lead.phone,
                email: lead.email,
                address: lead.address,
                linked: lead.customer?.name ?? null,
              }}
              items={lead.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                productName:
                  item.product?.name ??
                  item.itemDescription ??
                  "Requested item",
                quantity: item.quantity.toString(),
                uom: item.uom,
                targetPrice: item.targetPrice?.toString() ?? "",
                configuredPrice: item.product?.sellingPrice?.toString() ?? "",
                specifications: parseSpecifications(item.specifications),
              }))}
              products={salesProducts}
              requiredDeliveryDate={
                lead.requiredDeliveryDate?.toISOString().slice(0, 10) ?? ""
              }
              promisedDeliveryDate={
                lead.promisedDeliveryDate?.toISOString().slice(0, 10) ?? ""
              }
            />
          ) : null}
        </div>

        <aside className="min-w-0">
          <SectionCard title="Order & follow-up">
            <KeyValueList
              rows={[
                {
                  label: "Linked sales order",
                  value: lead.salesOrder ? (
                    <span className="inline-flex flex-wrap items-center justify-end gap-1">
                      <Link
                        className="text-[var(--detail-blue)] hover:underline"
                        href={`/sales/${lead.salesOrder.id}`}
                      >
                        {lead.salesOrder.number}
                      </Link>
                      <StatusBadge status={lead.salesOrder.status} />
                    </span>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Required delivery",
                  value: lead.requiredDeliveryDate
                    ? when(lead.requiredDeliveryDate)
                    : "—",
                },
                {
                  label: "Promised delivery",
                  value: lead.promisedDeliveryDate
                    ? when(lead.promisedDeliveryDate)
                    : "—",
                  subline:
                    lead.requiredDeliveryDate &&
                    lead.promisedDeliveryDate &&
                    new Date(lead.promisedDeliveryDate).getTime() >
                      new Date(lead.requiredDeliveryDate).getTime()
                      ? "Later than requested"
                      : undefined,
                },
                {
                  label: "Assigned salesperson",
                  value: lead.assignee?.name || "Unassigned",
                },
                {
                  label: "Next follow-up",
                  value: lead.nextFollowUpAt ? when(lead.nextFollowUpAt) : "—",
                },
                {
                  label: "Official follow-up",
                  value: lead.result ? (
                    <StatusBadge status={lead.result} />
                  ) : (
                    "—"
                  ),
                  subline: lead.attendedBy?.name || undefined,
                },
                {
                  label: "Verified",
                  value: lead.verifiedAt
                    ? lead.verifiedBy?.name || "Verified"
                    : "—",
                  subline: lead.verifiedAt ? when(lead.verifiedAt) : undefined,
                },
              ]}
            />
            {lead.verificationNotes ? (
              <p className="mt-2 border-t border-[var(--detail-border)] pt-2 text-[9px] text-[var(--ink-muted)]">
                {lead.verificationNotes}
              </p>
            ) : null}
          </SectionCard>
        </aside>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <SectionCard title="Activity history" count={lead.activities.length}>
          <Timeline
            items={lead.activities.map((activity) => ({
              title: labelFor(activity.activityType),
              description: activity.description,
              date: activity.createdAt,
              user: activity.performedBy.name,
            }))}
          />
        </SectionCard>
        <SectionCard title="Status history" count={lead.statusHistory.length}>
          <StatusHistoryList items={statusHistory} />
        </SectionCard>
      </div>
    </div>
  );
}
