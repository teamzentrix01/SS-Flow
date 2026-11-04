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
  StatusBadge,
  StatusHistoryList,
  Timeline,
  type WorkflowStep,
} from "@/components/detail";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { ALWAYS_HIDDEN_SPEC_KEYS } from "@/lib/domain/product-spec-fields";
import { labelFor, when } from "@/lib/format";
import { LeadStaleBadge } from "@/components/leads/lead-follow-up-badges";
import { isFollowUpOverdue, leadStaleLevel } from "@/modules/leads/follow-up";
import { LeadPossibleDuplicates } from "@/components/leads/lead-possible-duplicates";
import { LeadQuotationsPanel } from "@/components/leads/lead-quotations-panel";
import { LeadSentQuotationDownloads } from "@/components/leads/lead-sent-quotation-downloads";
import { listSentQuotationsForLead } from "@/modules/leads/quotations/queries";
import { materialAvailableQty } from "@/modules/leads/stock-check";
import { leadOrderTypeLabel } from "@/modules/leads/order-type";
import { lostReasonLabel } from "@/modules/leads/lost-reason";
import { leadCanConvert, leadCanVerify, leadPriorityLabel, leadSourceLabel } from "@/modules/leads/status";
import { prisma } from "@/db";
import { leadDetail, leadDuplicateMatches } from "@/modules/leads/queries";
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

type LeadItemSpecRow = {
  specs: SpecRecord;
  description: string;
  dimensions: string;
  sku: string;
  grade: string;
  thickness: string;
  mfgFinish: string | null;
  mfgSizeOrCapacity: string | null;
  mfgPacking: string | null;
  mfgLogoRequired: boolean;
  mfgArtworkUrl: string | null;
  mfgPricingBasis: string | null;
  mfgInStock: boolean | null;
  mfgLeadDays: number | null;
};

function collectLeadItemSpecEntries(row: LeadItemSpecRow) {
  const specs = row.specs;
  const picked: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (value != null && value !== "") picked.push({ label, value: cleanValue(value) });
  };
  add("Design form", specs.designForm ?? specs.design_form ?? specs.form);
  add("Dimensions", specs.dimensions ?? row.dimensions);
  add("Drawing reference", specs.drawingReference ?? specs.drawing_reference);
  add("Product SKU", row.sku);
  add("Compatible utensil type", specs.compatibleUtensilType ?? specs.compatible_utensil_type);
  add("Product name", specs.productName ?? specs.product_name ?? row.description);
  add("Finish", row.mfgFinish ?? specs.finish);
  add("Size / capacity", row.mfgSizeOrCapacity);
  add("Packing", row.mfgPacking);
  if (row.mfgLogoRequired) add("Logo required", "Yes");
  add("Artwork URL", row.mfgArtworkUrl);
  if (row.mfgPricingBasis)
    add("Pricing basis", row.mfgPricingBasis === "PER_KG" ? "Per kg" : "Per piece");
  if (row.mfgInStock != null)
    add("Fulfillment", row.mfgInStock ? "In stock" : "Must produce");
  if (row.mfgLeadDays != null) add("Est. lead time (days)", row.mfgLeadDays);
  add("Grade", row.grade !== "—" ? row.grade : specs.grade);
  add("Thickness", row.thickness !== "—" ? row.thickness : specs.thickness);
  add("Width", specs.width);
  add("Length", specs.length);
  add("Diameter", specs.diameter);
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
    "grade",
    "thickness",
    "finish",
    ...ALWAYS_HIDDEN_SPEC_KEYS,
  ]);
  for (const [key, value] of Object.entries(specs))
    if (!omitted.has(key) && value != null && value !== "")
      add(specLabel(key), value);
  return picked;
}

function formatItemDimensions(
  specs: SpecRecord,
  item: { product?: { width?: unknown; length?: unknown } | null; sizeOrCapacity?: string | null },
) {
  const parts: string[] = [];
  const width = specs.width ?? item.product?.width;
  const length = specs.length ?? item.product?.length;
  const diameter = specs.diameter;
  const size = specs.size ?? item.sizeOrCapacity;
  if (width != null && width !== "" && length != null && length !== "")
    parts.push(`${cleanValue(width)} × ${cleanValue(length)}`);
  else if (width != null && width !== "") parts.push(`W ${cleanValue(width)}`);
  else if (length != null && length !== "") parts.push(`L ${cleanValue(length)}`);
  if (diameter != null && diameter !== "") parts.push(`Ø ${cleanValue(diameter)}`);
  if (size != null && size !== "" && parts.length === 0) parts.push(cleanValue(size));
  if (specs.dimensions != null && specs.dimensions !== "" && parts.length === 0)
    return cleanValue(specs.dimensions);
  return parts.length ? parts.join(" · ") : "—";
}

function specCell(entries: { label: string; value: string }[]) {
  if (!entries.length) return "—";
  return (
    <ul className="m-0 min-w-[140px] list-none space-y-0.5 p-0">
      {entries.map((entry, index) => (
        <li key={`${entry.label}-${index}`} className="leading-snug">
          <span className="text-[var(--detail-muted)]">{entry.label}:</span>{" "}
          <span className="font-semibold">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

function specsAlreadyInColumns(row: LeadItemSpecRow & { finish: string; packing: string; diameter: string }) {
  const skip = new Set<string>(["Product name"]);
  if (row.sku && row.sku !== "—") skip.add("Product SKU");
  if (row.grade && row.grade !== "—") skip.add("Grade");
  if (row.thickness && row.thickness !== "—") skip.add("Thickness");
  if (row.dimensions && row.dimensions !== "—") skip.add("Dimensions");
  if (row.finish && row.finish !== "—") skip.add("Finish");
  if (row.packing && row.packing !== "—") skip.add("Packing");
  if (row.diameter && row.diameter !== "—") skip.add("Diameter");
  const length = row.specs.length;
  if (length != null && length !== "" && row.dimensions.includes(cleanValue(length)))
    skip.add("Length");
  return skip;
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
  const duplicateMatches = await leadDuplicateMatches(lead.plantId, {
    id: lead.id,
    phone: lead.phone,
    email: lead.email,
    gstin: lead.gstin,
  });
  const sentQuotations = await listSentQuotationsForLead(lead.id, plantIds);

  const canConvert =
    session.permissions.has("lead.convert") &&
    leadCanConvert(lead.status) &&
    lead.items.length > 0;
  const fulfillmentPreviewStatuses = [
    "QUOTATION_SENT",
    "NEGOTIATION",
    "SAMPLE_APPROVAL",
    "VERIFIED",
  ] as const;
  const showFulfillmentPreview =
    !lead.salesOrder &&
    fulfillmentPreviewStatuses.includes(
      lead.status as (typeof fulfillmentPreviewStatuses)[number],
    ) &&
    (session.permissions.has("lead.manage") || session.permissions.has("lead.convert"));
  const needsSalesProducts = canConvert || showFulfillmentPreview;
  const [salesProducts, categories] = await Promise.all([
    needsSalesProducts ? listSalesOrderProducts(plantIds) : Promise.resolve([]),
    listCategories(plantIds),
  ]);
  const productStock: Record<string, number> = {};
  if (needsSalesProducts) {
    const stockEntries = await Promise.all(
      salesProducts.map(async (product) => [
        product.id,
        await materialAvailableQty(prisma, lead.plantId, product.id),
      ] as const),
    );
    for (const [productId, qty] of stockEntries) productStock[productId] = qty;
  }
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
    const mfgWeightGrams = item.weightPerPieceGrams?.toString();
    const categoryId =
      typeof specs.categoryId === "string" ? specs.categoryId : "";
    const dimensions = formatItemDimensions(specs, item);
    const sku = cleanValue(
      item.productVariant?.sku ?? item.product?.code ?? specs.productSku ?? specs.sku,
    );
    const finish = cleanValue(item.finish ?? specs.finish);
    const packing = cleanValue(item.packing);
    const diameter =
      specs.diameter != null && specs.diameter !== ""
        ? cleanValue(specs.diameter)
        : "—";
    const baseRow: LeadItemSpecRow = {
      specs,
      description: String(
        specs.variantDisplayName ??
          item.product?.name ??
          item.itemDescription ??
          "—",
      ),
      dimensions,
      sku,
      grade: cleanValue(item.mfgGrade ?? specs.grade ?? item.product?.grade),
      thickness: cleanValue(
        item.gaugeThicknessMm?.toString() ??
          specs.thickness ??
          item.product?.thickness?.toString(),
      ),
      mfgFinish: item.finish,
      mfgSizeOrCapacity: item.sizeOrCapacity,
      mfgPacking: item.packing,
      mfgLogoRequired: item.logoRequired,
      mfgArtworkUrl: item.artworkUrl,
      mfgPricingBasis: item.pricingBasis,
      mfgInStock: item.inStock,
      mfgLeadDays: item.estimatedLeadTimeDays,
    };
    const allSpecs = collectLeadItemSpecEntries(baseRow);
    const skipLabels = specsAlreadyInColumns({
      ...baseRow,
      finish,
      packing,
      diameter,
    });
    const inlineSpecs = allSpecs.filter((entry) => !skipLabels.has(entry.label));
    return {
      category:
        item.product?.productCategory?.name ??
        (typeof specs.categoryName === "string"
          ? specs.categoryName
          : categoryNames.get(categoryId)) ??
        "—",
      description: baseRow.description,
      grade: baseRow.grade,
      thickness: baseRow.thickness,
      dimensions,
      sku,
      finish,
      diameter,
      packing,
      inlineSpecs: specCell(inlineSpecs),
      quantity: item.quantity.toString(),
      uom: item.uom,
      weight: cleanValue(
        item.estimatedWeight?.toString() ??
          mfgWeightGrams ??
          specs.unitWeight ??
          item.product?.weightPerPiece?.toString(),
      ),
      marketPrice: item.marketPrice?.toString() ?? item.product?.sellingPrice?.toString() ?? "",
      priceOffered: item.priceOffered?.toString() ?? "",
      expectedDelivery: item.expectedDeliveryDate
        ? when(item.expectedDeliveryDate)
        : "—",
    };
  });
  const formatPrice = (value: string) => (value ? `₹${value}` : "—");
  const tableRows = rows.map((row) => ({
    category: row.category,
    description: row.description,
    sku: row.sku,
    grade: row.grade,
    thickness: row.thickness,
    finish: row.finish,
    dimensions: row.dimensions,
    diameter: row.diameter,
    packing: row.packing,
    specifications: row.inlineSpecs,
    quantity: row.quantity,
    uom: row.uom,
    marketRate: formatPrice(row.marketPrice),
    offerRate: formatPrice(row.priceOffered),
    expectedDelivery: row.expectedDelivery,
    weight: row.weight,
  }));

  const sourceText = labelFor(lead.source);
  const contactName = lead.contactPerson || lead.customerName;
  const companyName =
    lead.companyName || lead.customer?.name || lead.customerName;
  const staleLevel = leadStaleLevel(lead.status, lead.lastActivityAt);
  const followUpOverdue = isFollowUpOverdue(lead.status, lead.nextFollowUpAt);
  const statusHistory = lead.statusHistory.map((history) => ({
    from: history.oldStatus,
    to: history.newStatus,
    reason: history.reason,
    date: history.createdAt,
    user: history.changedBy.name,
  }));

  return (
    <div className="mx-auto w-full max-w-[min(100%,1680px)] space-y-[18px] rounded-xl bg-[var(--detail-bg)] p-3 sm:p-5">
      <PageHeader
        breadcrumb={`Leads / ${lead.leadNumber}`}
        title={lead.leadNumber}
        status={lead.status}
        source={lead.source}
        meta={`Created ${when(lead.createdAt)} · ${leadSourceLabel(lead.source)} · ${leadOrderTypeLabel(lead.orderType)} · ${leadPriorityLabel(lead.priority)} priority`}
        action={
          lead.salesOrder ? (
            <DetailActionLink href={`/sales/${lead.salesOrder.id}`}>
              View sales order {lead.salesOrder.number}
            </DetailActionLink>
          ) : undefined
        }
      />

      <ProgressStepper steps={workflow} />

      {sentQuotations.length ? (
        <LeadSentQuotationDownloads quotations={sentQuotations} />
      ) : null}

      {duplicateMatches.length ? (
        <LeadPossibleDuplicates matches={duplicateMatches} />
      ) : null}

      {staleLevel !== "none" || followUpOverdue ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <LeadStaleBadge level={staleLevel} />
          {followUpOverdue ? (
            <span className="text-xs font-semibold text-danger">Next follow-up overdue</span>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
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
                  subline: lead.gstin ? `GSTIN ${lead.gstin}` : leadPriorityLabel(lead.priority),
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

        <aside className="min-w-0 lg:row-span-1">
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
                  subline: lead.salesOrder
                    ? `Status · ${labelFor(lead.salesOrder.status)}`
                    : undefined,
                },
                ...(lead.repeatOrderFollowUpAt
                  ? [
                      {
                        label: "Repeat order follow-up",
                        value: when(lead.repeatOrderFollowUpAt),
                        subline: lead.repeatOrderFollowUpDays
                          ? `Every ${lead.repeatOrderFollowUpDays} days (configured)`
                          : undefined,
                      },
                    ]
                  : lead.status === "CONVERTED" && lead.repeatOrderFollowUpDays
                    ? [
                        {
                          label: "Repeat order follow-up",
                          value: "Completed or pending notification",
                          subline: `${lead.repeatOrderFollowUpDays}-day schedule`,
                        },
                      ]
                    : []),
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
                  value: lead.nextFollowUpAt ? (
                    <span className={followUpOverdue ? "font-semibold text-danger" : undefined}>
                      {when(lead.nextFollowUpAt)}
                    </span>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Last activity",
                  value: lead.lastActivityAt ? when(lead.lastActivityAt) : "—",
                },
                {
                  label: "First response",
                  value:
                    lead.firstResponseMinutes != null
                      ? `${lead.firstResponseMinutes} min`
                      : lead.firstContactedAt
                        ? when(lead.firstContactedAt)
                        : "—",
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
                ...(lead.status === "LOST" || lead.status === "REJECTED"
                  ? [
                      {
                        label: lead.status === "LOST" ? "Lost reason" : "Rejected reason",
                        value: lead.lostReasonCode
                          ? lostReasonLabel(
                              lead.lostReasonCode,
                              lead.status as "LOST" | "REJECTED",
                            )
                          : lead.lostReason ?? "—",
                        subline: lead.lostReasonNote ?? undefined,
                      },
                    ]
                  : []),
                ...(lead.competitorName || lead.competitorRate
                  ? [
                      {
                        label: "Competitor",
                        value: lead.competitorName ?? "—",
                        subline: lead.competitorRate
                          ? `Rate ${lead.competitorRate.toString()}`
                          : undefined,
                      },
                    ]
                  : []),
                ...(lead.customerTargetRate
                  ? [
                      {
                        label: "Customer target rate",
                        value: lead.customerTargetRate.toString(),
                      },
                    ]
                  : []),
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

      <SectionCard title="Requested items" count={lead.items.length}>
        <div className="-mx-4 -mb-4">
          <DataTable
            minTableWidth={1500}
            columns={[
              { key: "category", label: "Category", minWidth: 100 },
              { key: "description", label: "Material / description", minWidth: 160 },
              { key: "sku", label: "SKU", minWidth: 120 },
              { key: "grade", label: "Grade", minWidth: 56 },
              { key: "thickness", label: "Thickness", minWidth: 72 },
              { key: "finish", label: "Finish", minWidth: 56 },
              { key: "dimensions", label: "Dimensions", minWidth: 88 },
              { key: "diameter", label: "Diameter", minWidth: 72 },
              { key: "packing", label: "Packing", minWidth: 88 },
              { key: "specifications", label: "Specifications", minWidth: 200 },
              { key: "quantity", label: "Qty", align: "right", minWidth: 48 },
              { key: "uom", label: "UOM", minWidth: 44 },
              { key: "marketRate", label: "Market rate", align: "right", minWidth: 88 },
              { key: "offerRate", label: "Offered to customer", align: "right", minWidth: 100 },
              { key: "expectedDelivery", label: "Exp. delivery", minWidth: 96 },
              { key: "weight", label: "Unit wt.", align: "right", minWidth: 72 },
            ]}
            rows={tableRows}
          />
        </div>
      </SectionCard>

      {!lead.salesOrder &&
      (session.permissions.has("lead.view") || session.permissions.has("lead.manage")) ? (
        <LeadQuotationsPanel
          leadId={lead.id}
          canManage={session.permissions.has("lead.manage")}
          canApprove={session.permissions.has("quotation.approve")}
        />
      ) : null}

      {lead.salesOrder ? (
            <CalloutBanner
              title="Converted to sales order"
              description={
                <>
                  Order{" "}
                  <Link
                    className="font-medium text-[var(--detail-blue)] hover:underline"
                    href={`/sales/${lead.salesOrder.id}`}
                  >
                    {lead.salesOrder.number}
                  </Link>{" "}
                  · current status{" "}
                  <StatusBadge status={lead.salesOrder.status} />
                  {lead.convertedAt ? (
                    <span className="text-muted"> · converted {when(lead.convertedAt)}</span>
                  ) : null}
                </>
              }
              action={
                <DetailActionLink href={`/sales/${lead.salesOrder.id}`}>
                  Open sales order
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
              orderType={lead.orderType}
              canVerify={
                session.permissions.has("lead.verify") &&
                leadCanVerify(lead.status)
              }
              canManage={session.permissions.has("lead.manage")}
              canConvert={canConvert}
              showFulfillmentPreview={showFulfillmentPreview}
              productStock={needsSalesProducts ? productStock : undefined}
              products={needsSalesProducts ? salesProducts : []}
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
              requiredDeliveryDate={
                lead.requiredDeliveryDate?.toISOString().slice(0, 10) ?? ""
              }
              promisedDeliveryDate={
                lead.promisedDeliveryDate?.toISOString().slice(0, 10) ?? ""
              }
              competitorName={lead.competitorName ?? ""}
              competitorRate={lead.competitorRate?.toString() ?? ""}
              customerTargetRate={lead.customerTargetRate?.toString() ?? ""}
            />
          ) : null}

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
