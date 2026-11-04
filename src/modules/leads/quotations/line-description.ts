type SpecRecord = Record<string, unknown>;

function parseSpecs(value: unknown): SpecRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as SpecRecord;
  return {};
}

function specString(value: unknown) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

function isWeakDescription(text: string | null | undefined) {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return true;
  return (
    t === "hello" ||
    t === "test" ||
    t === "requested material" ||
    t === "requested item" ||
    t === "to be specified" ||
    t.length < 3
  );
}

export type LeadItemLineSource = {
  itemDescription?: string | null;
  specifications?: unknown;
  sizeOrCapacity?: string | null;
  mfgGrade?: string | null;
  gaugeThicknessMm?: { toString(): string } | null;
  product?: { name?: string | null; code?: string | null; grade?: string | null } | null;
  parentProduct?: { name?: string | null; sku?: string | null } | null;
  productVariant?: { displayName?: string | null; sku?: string | null } | null;
};

/** Primary product / material title for quotation lines (from lead create data). */
export function buildLeadItemLineTitle(item: LeadItemLineSource): string {
  const specs = parseSpecs(item.specifications);
  const variantName = specString(specs.variantDisplayName);
  const fromCatalog =
    variantName ||
    item.productVariant?.displayName?.trim() ||
    item.parentProduct?.name?.trim() ||
    item.product?.name?.trim() ||
    "";

  if (fromCatalog) return fromCatalog;

  if (!isWeakDescription(item.itemDescription)) {
    return item.itemDescription!.trim();
  }

  return item.product?.name?.trim() || "Requested material";
}

/** Spec subtitle (grade, thickness, dimensions, finish). */
export function buildLeadItemLineSpecSummary(item: LeadItemLineSource): string {
  const specs = parseSpecs(item.specifications);
  const parts: string[] = [];

  const grade = specString(item.mfgGrade ?? specs.grade ?? item.product?.grade);
  if (grade) parts.push(`Grade ${grade}`);

  const thickness = specString(specs.thickness ?? item.gaugeThicknessMm?.toString());
  if (thickness) parts.push(`${thickness} mm`);

  const width = specString(specs.width);
  const length = specString(specs.length);
  const diameter = specString(specs.diameter);
  if (width && length) parts.push(`${width} × ${length} mm`);
  else if (width) parts.push(`W ${width} mm`);
  else if (length) parts.push(`L ${length} mm`);
  else if (diameter) parts.push(`Ø ${diameter} mm`);

  const finish = specString(specs.finish);
  if (finish) parts.push(String(finish));

  const size = specString(item.sizeOrCapacity ?? specs.size);
  if (size && !parts.some((p) => p.includes(size))) parts.push(size);

  const sku =
    item.productVariant?.sku?.trim() ||
    item.parentProduct?.sku?.trim() ||
    item.product?.code?.trim() ||
    specString(specs.productSku ?? specs.sku);
  if (sku) parts.push(`SKU ${sku}`);

  return parts.join(" · ");
}

export function buildLeadItemLineDescription(item: LeadItemLineSource): string {
  const title = buildLeadItemLineTitle(item);
  const specs = buildLeadItemLineSpecSummary(item);
  if (specs) return `${title} — ${specs}`;
  return title;
}

export function buildLeadItemSizeColumn(item: LeadItemLineSource, fallback?: string | null) {
  const specs = parseSpecs(item.specifications);
  const size = specString(item.sizeOrCapacity ?? specs.size ?? fallback);
  if (size) return size;
  const width = specString(specs.width);
  const length = specString(specs.length);
  if (width && length) return `${width} × ${length} mm`;
  return fallback?.trim() || "—";
}

export function buildLeadItemGradeColumn(item: LeadItemLineSource, fallback?: string | null) {
  const specs = parseSpecs(item.specifications);
  return (
    specString(item.mfgGrade ?? specs.grade ?? item.product?.grade ?? fallback) || "—"
  );
}

export type QuotationLineForDisplay = {
  description?: string | null;
  grade?: string | null;
  size?: string | null;
  product?: LeadItemLineSource["product"];
  leadItem?: LeadItemLineSource | null;
};

/** Resolve PDF/UI line text from linked lead item when available. */
export function quotationLinePresentation(line: QuotationLineForDisplay) {
  const src: LeadItemLineSource | null = line.leadItem
    ? {
        ...line.leadItem,
        product: line.leadItem.product ?? line.product ?? undefined,
      }
    : null;

  if (src) {
    const title = buildLeadItemLineTitle(src);
    const spec = buildLeadItemLineSpecSummary(src);
    return {
      title,
      spec,
      grade: buildLeadItemGradeColumn(src, line.grade),
      size: buildLeadItemSizeColumn(src, line.size),
    };
  }

  const raw = line.description?.trim() || line.product?.name?.trim() || "—";
  const dash = raw.indexOf(" — ");
  if (dash > 0) {
    return {
      title: raw.slice(0, dash),
      spec: raw.slice(dash + 3),
      grade: line.grade?.trim() || "—",
      size: line.size?.trim() || "—",
    };
  }

  return {
    title: raw,
    spec: "",
    grade: line.grade?.trim() || "—",
    size: line.size?.trim() || "—",
  };
}
