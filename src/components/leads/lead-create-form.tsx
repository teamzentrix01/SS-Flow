"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Upload, X, FileText, Loader2 } from "lucide-react";
import { CreatableSpecSelect } from "@/components/ui/creatable-spec-select";
import { toast } from "@/components/toast";
import {
  resolveProductFieldConfig,
  visibleProductFields,
  missingRequiredSpecFields,
  invalidNumericSpecFields,
  findBestVariantForSpecs,
  isProductComingSoon,
  isAllowedDesignFile,
} from "@/lib/domain/product-spec-fields";
import {
  useFieldArray,
  useForm,
  useWatch,
  type UseFormRegister,
  type UseFormSetValue,
  type Control,
} from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { usePost } from "@/components/use-post";
import { LEAD_SOURCES } from "@/modules/leads/status";

const SOURCE_LABELS: Record<string, string> = {
  PHONE: "Phone call",
  VISIT: "Visit",
  REFERRAL: "Referral",
  OTHER: "Other",
};

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const CUSTOMER_INPUT_SPEC_KEYS = new Set([
  "pvdColour",
  "dimensions",
  "requiredDimensions",
  "drawingReference",
  "designReference",
  "cutProfile",
  "wireGauge",
  "wireDiameterMm",
  "cutLengthMm",
  "finishOrCondition",
  "capacityLitres",
  "materialGrade",
  "thickness",
  "width",
  "length",
  "diameter",
  "finish",
  "packing",
]);
const NUMERIC_SPEC_KEYS = new Set([
  "thickness",
  "width",
  "length",
  "diameter",
  "weightPerPiece",
  "netWeightKg",
  "innerDiameter",
  "outerDiameter",
  "wireGauge",
  "height",
  "capacityLitres",
  "innerDiameterMm",
  "outerDiameterMm",
  "wireDiameterMm",
  "cutLengthMm",
]);
const CONFIGURABLE_SPEC_VALUE =
  /^(confirm|configure|customer specified|customer supplied|customer drawing|optional\b|per approved)/i;

function isCustomerInputSpecification(key: string, value: unknown) {
  return (
    CUSTOMER_INPUT_SPEC_KEYS.has(key) &&
    typeof value === "string" &&
    CONFIGURABLE_SPEC_VALUE.test(value.trim())
  );
}

type LeadItemValues = {
  categoryId: string;
  productId: string;
  parentProductId: string;
  productVariantId: string;
  specifications: Record<string, string>;
  size: string;
  quantity: string;
  uom: string;
  estimatedWeight: string;
  description: string;
  remarks: string;
};

type FormValues = {
  queryDate: string;
  queryTime: string;
  contactPerson: string;
  contactDesignation: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  customerId: string;
  source: (typeof LEAD_SOURCES)[number];
  priority: (typeof PRIORITIES)[number];
  assigneeId: string;
  nextFollowUpAt: string;
  notes: string;
  requiredDeliveryDate: string;
  promisedDeliveryDate: string;
  customerRemarks: string;
  items: LeadItemValues[];
  attendedById: string;
  result: "PENDING" | "SUCCESS" | "FAILURE";
  resultReason: string;
  officeRemarks: string;
};

const fieldClass =
  "h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-info focus-visible:ring-2 focus-visible:ring-info/25";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nowTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function emptyItem(uom: string): LeadItemValues {
  return {
    categoryId: "",
    productId: "",
    parentProductId: "",
    productVariantId: "",
    specifications: {},
    size: "",
    quantity: "1",
    uom,
    estimatedWeight: "",
    description: "",
    remarks: "",
  };
}

function LeadField({
  label,
  required,
  detail,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  detail?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
        {detail ? <span className="ml-1 text-xs font-normal text-muted/80">({detail})</span> : null}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SectionCard({
  step,
  title,
  detail,
  children,
}: {
  step: number;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info text-sm font-semibold text-white">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{detail}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

type UploadedDesignFile = {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
};

function DesignFilesField({
  files,
  onChange,
  disabled,
}: {
  files: UploadedDesignFile[];
  onChange: (files: UploadedDesignFile[]) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList);
    for (const f of selected) {
      if (!isAllowedDesignFile({ name: f.name, type: f.type, size: f.size })) {
        toast.error(`"${f.name}" is not supported. Upload PDF, DXF, DWG, PNG, or JPG up to 10MB.`);
        return;
      }
    }
    setUploading(true);
    try {
      const formData = new FormData();
      selected.forEach((f) => formData.append("files", f));
      const response = await fetch("/api/v1/leads/design-files", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to upload design file");
      }
      const newFiles = [...files, ...(data.data?.files ?? [])];
      onChange(newFiles);
      toast.success("Design file uploaded successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted/50 ${
            disabled || uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-muted" />
          )}
          <span>{uploading ? "Uploading..." : "Upload drawing (PDF, DXF, DWG, Image)"}</span>
          <input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.dxf,.dwg,.png,.jpg,.jpeg"
            onChange={handleUpload}
            disabled={disabled || uploading}
          />
        </label>
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span className="max-w-[140px] truncate" title={file.originalName}>
                {file.originalName}
              </span>
              <span className="text-[10px] text-muted">
                ({(file.sizeBytes / 1024).toFixed(0)} KB)
              </span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="text-muted hover:text-danger ml-0.5"
                title="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadItemFields({
  index,
  register,
  control,
  setValue,
  canRemove,
  onRemove,
  categories,
  products,
  canManageProducts,
}: {
  index: number;
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  canRemove: boolean;
  onRemove: () => void;
  categories: { id: string; name: string }[];
  products: {
    id: string;
    name: string;
    sku: string;
    categoryId: string;
    categoryName: string;
    variants: {
      id: string;
      materialMasterId: string;
      sku: string;
      displayName: string;
      uom: string;
      specs: Record<string, unknown>;
    }[];
  }[];
  canManageProducts: boolean;
}) {
  const categoryId = useWatch({ control, name: `items.${index}.categoryId` });
  const parentProductId = useWatch({
    control,
    name: `items.${index}.parentProductId`,
  });
  const selectedVariantId = useWatch({
    control,
    name: `items.${index}.productVariantId`,
  });
  const selectedSpecs =
    (useWatch({ control, name: `items.${index}.specifications` }) as Record<string, string>) ?? {};
  const uom = useWatch({ control, name: `items.${index}.uom` });

  const visibleProducts = products.filter(
    (product) => !categoryId || product.categoryId === categoryId,
  );
  const selectedParent = products.find(
    (product) => product.id === parentProductId,
  );
  const variants = selectedParent?.variants ?? [];
  const config = resolveProductFieldConfig(selectedParent);

  // Config-driven fields and validations
  const fields = config ? visibleProductFields(config, selectedSpecs) : [];
  const missingRequired = config
    ? missingRequiredSpecFields(config, selectedSpecs)
    : [];
  const invalidNumeric = config
    ? invalidNumericSpecFields(config, selectedSpecs)
    : [];
  const isSpecComplete = Boolean(
    selectedParent &&
      (config
        ? missingRequired.length === 0 && invalidNumeric.length === 0
        : selectedVariantId),
  );

  // Fallback for unconfigured products
  const hiddenKeys = new Set([
    "categoryId",
    "categoryName",
    "productId",
    "productName",
    "productSku",
    "productVariantId",
    "variantDisplayName",
  ]);
  const specOrder = ["grade", "finish", "thickness", "width", "length", "diameter"];
  const fallbackSpecKeys = [
    ...new Set(
      variants.flatMap((variant) =>
        Object.entries(variant.specs)
          .filter(
            ([key, value]) =>
              !hiddenKeys.has(key) &&
              value !== null &&
              value !== undefined &&
              value !== "",
          )
          .map(([key]) => key),
      ),
    ),
  ].sort((a, b) => {
    const ai = specOrder.indexOf(a);
    const bi = specOrder.indexOf(b);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.localeCompare(b);
  });
  const fallbackCustomerInputKeys = new Set(
    fallbackSpecKeys.filter((key) => {
      const values = variants
        .map((variant) => variant.specs[key])
        .filter((value) => value !== null && value !== undefined && value !== "");
      return values.length > 0 && values.every((value) => isCustomerInputSpecification(key, value));
    }),
  );
  const fallbackSelectorKeys = fallbackSpecKeys.filter((key) => !fallbackCustomerInputKeys.has(key));
  const fallbackSelectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const fallbackCustomerInputFields = fallbackSelectedVariant
    ? Object.entries(fallbackSelectedVariant.specs).filter(
        ([key, value]) =>
          fallbackCustomerInputKeys.has(key) && isCustomerInputSpecification(key, value),
      )
    : [];

  const specLabel = (key: string) =>
    ({
      grade: "Grade",
      finish: "Finish",
      thickness: "Thickness",
      width: "Width",
      length: "Length",
      diameter: "Diameter",
      wireDiameterMm: "Wire diameter",
      cutLengthMm: "Cut length",
      innerDiameterMm: "Inner diameter",
      outerDiameterMm: "Outer diameter",
      finishOrCondition: "Finish / condition",
      drawingReference: "Drawing reference",
      designReference: "Design reference",
      dimensions: "Required dimensions",
      capacityLitres: "Capacity",
      materialGrade: "Material grade",
      pvdColour: "PVD colour",
      packing: "Packing",
      productionRemarks: "Production Remarks",
      cutProfile: "Cut Profile",
      decorativeSubtype: "Decorative Subtype",
      sizeNote: "Size Note",
      breadth: "Breadth",
    })[key] ??
    key
      .replaceAll(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase());

  const specUnit = (key: string) =>
    ({
      thickness: "mm",
      width: "mm",
      length: "mm",
      breadth: "mm",
      diameter: "mm",
      wireDiameterMm: "mm",
      cutLengthMm: "mm",
      innerDiameterMm: "mm",
      outerDiameterMm: "mm",
      capacityLitres: "L",
      weightPerPiece: "kg",
    })[key] ?? "";

  const optionsFor = (key: string) =>
    [
      ...new Set(
        variants
          .map((variant) => variant.specs[key])
          .filter(
            (value) =>
              value !== null &&
              value !== undefined &&
              value !== "" &&
              !isCustomerInputSpecification(key, value),
          )
          .map(String),
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const syncVariantAndUom = (newSpecs: Record<string, string>) => {
    if (!config) return;
    const missing = missingRequiredSpecFields(config, newSpecs);
    const invalid = invalidNumericSpecFields(config, newSpecs);
    const complete = missing.length === 0 && invalid.length === 0;

    if (complete) {
      const best = findBestVariantForSpecs(variants, newSpecs, config);
      if (best) {
        setValue(`items.${index}.productVariantId`, best.id);
        setValue(`items.${index}.productId`, best.materialMasterId);
        // Wire auto-UOM logic
        if (config.id === "wire") {
          const formVal = newSpecs.productForm ?? "";
          if (/cut/i.test(formVal)) {
            setValue(`items.${index}.uom`, "PCS");
          } else if (/coil/i.test(formVal)) {
            setValue(`items.${index}.uom`, "KG");
          } else {
            setValue(`items.${index}.uom`, best.uom || "KG");
          }
        } else if (config.id === "laser_cut_farma") {
          setValue(`items.${index}.uom`, "PCS");
        } else {
          setValue(`items.${index}.uom`, best.uom || "PCS");
        }
      }
    } else {
      setValue(`items.${index}.productVariantId`, "");
      setValue(`items.${index}.productId`, "");
      setValue(`items.${index}.uom`, "");
    }
  };

  const handleSpecChange = (key: string, value: string) => {
    const nextSpecs = { ...selectedSpecs };
    if (value) {
      nextSpecs[key] = value;
    } else {
      delete nextSpecs[key];
    }

    // Sheet: If finish changed and is not decorative, clear decorativeSubtype
    if (config?.id === "sheet" && key === "finish") {
      if (!/pvd|mirror|matt/i.test(value)) {
        delete nextSpecs.decorativeSubtype;
      }
    }

    // Wire: If productForm changed and is not cut piece, clear cutLengthMm
    if (config?.id === "wire" && key === "productForm") {
      if (!/cut/i.test(value)) {
        delete nextSpecs.cutLengthMm;
      }
    }

    setValue(`items.${index}.specifications`, nextSpecs);
    syncVariantAndUom(nextSpecs);
  };

  const handleFilesChange = (uploadedFiles: UploadedDesignFile[]) => {
    const nextSpecs = {
      ...selectedSpecs,
      designFiles: uploadedFiles as unknown as string,
      designFileIds: uploadedFiles.map((f) => f.id) as unknown as string,
    };
    setValue(`items.${index}.specifications`, nextSpecs as Record<string, string>);
  };

  const setFallbackSpec = (key: string, value: string) => {
    const values = { ...selectedSpecs };
    const keyIndex = fallbackSelectorKeys.indexOf(key);
    for (const laterKey of fallbackSelectorKeys.slice(keyIndex + 1))
      delete values[laterKey];
    if (value) values[key] = value;
    else delete values[key];
    const matches = variants.filter((variant) =>
      fallbackSelectorKeys.every(
        (specKey) =>
          String(variant.specs[specKey] ?? "") === String(values[specKey] ?? ""),
      ),
    );
    const exact = matches.length === 1 ? matches[0] : undefined;
    const resolvedValues = exact
      ? Object.fromEntries(
          Object.entries(exact.specs)
            .filter(
              ([specKey, specValue]) =>
                specValue != null &&
                typeof specValue !== "object" &&
                !isCustomerInputSpecification(specKey, specValue),
            )
            .map(([specKey, specValue]) => [specKey, String(specValue)]),
        )
      : values;
    setValue(`items.${index}.specifications`, resolvedValues);
    setValue(`items.${index}.productVariantId`, exact?.id ?? "");
    setValue(`items.${index}.productId`, exact?.materialMasterId ?? "");
    setValue(`items.${index}.uom`, exact?.uom ?? "");
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Item {index + 1}</p>
        {canRemove ? (
          <button
            type="button"
            className="text-sm font-medium text-danger hover:underline"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <LeadField label="Business category">
          <select
            className={fieldClass}
            {...register(`items.${index}.categoryId`, {
              onChange: () => {
                setValue(`items.${index}.productId`, "");
                setValue(`items.${index}.productVariantId`, "");
                setValue(`items.${index}.parentProductId`, "");
                setValue(`items.${index}.specifications`, {});
                setValue(`items.${index}.size`, "");
                setValue(`items.${index}.uom`, "");
              },
            })}
          >
            <option value="">Select</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </LeadField>
        <LeadField label="Material / product">
          <select
            className={fieldClass}
            {...register(`items.${index}.parentProductId`, {
              onChange: (event) => {
                setValue(`items.${index}.productVariantId`, "");
                setValue(`items.${index}.productId`, "");
                setValue(`items.${index}.specifications`, {});
                setValue(`items.${index}.uom`, "");
                const parent = products.find(
                  (product) => product.id === event.target.value,
                );
                if (parent?.variants.length === 1 && !config) {
                  const variant = parent.variants[0];
                  setValue(`items.${index}.productVariantId`, variant.id);
                  setValue(
                    `items.${index}.productId`,
                    variant.materialMasterId,
                  );
                  setValue(`items.${index}.uom`, variant.uom);
                  setValue(
                    `items.${index}.specifications`,
                    Object.fromEntries(
                      Object.entries(variant.specs)
                        .filter(
                          ([key, value]) =>
                            value != null &&
                            typeof value !== "object" &&
                            !isCustomerInputSpecification(key, value),
                        )
                        .map(([key, value]) => [key, String(value)]),
                    ),
                  );
                }
              },
            })}
          >
            <option value="">Select</option>
            {visibleProducts.map((product) => {
              const comingSoon = isProductComingSoon(product);
              return (
                <option
                  key={product.id}
                  value={product.id}
                  disabled={comingSoon}
                >
                  {product.name}
                  {comingSoon ? " (Coming soon)" : ""}
                </option>
              );
            })}
            {!visibleProducts.length ? (
              <option value="" disabled>
                No matching products
              </option>
            ) : null}
          </select>
          {selectedParent && !variants.length ? (
            <p className="mt-1 text-xs text-muted">
              No specifications available for this product. Please add
              specifications in Product Master.
              {canManageProducts ? (
                <>
                  {" "}
                  <Link
                    className="font-medium text-accent underline"
                    href={`/products/catalog/${selectedParent.id}`}
                  >
                    Manage specifications
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </LeadField>

        {config ? (
          fields.map((field) => {
            const unit = field.unit || specUnit(field.key);
            const labelWithUnit = unit ? `${field.label} (${unit})` : field.label;

            if (field.type === "select") {
              return (
                <LeadField key={field.key} label={field.label}>
                  <CreatableSpecSelect
                    fieldName={field.key}
                    fieldLabel={field.label}
                    unit={unit}
                    value={selectedSpecs[field.key] ?? ""}
                    onChange={(val) => handleSpecChange(field.key, val)}
                    options={optionsFor(field.key)}
                    canCreate={canManageProducts}
                    categoryId={categoryId}
                    productId={parentProductId}
                    ariaLabel={`Select or add ${field.label}`}
                  />
                </LeadField>
              );
            }

            if (field.type === "number") {
              return (
                <LeadField key={field.key} label={labelWithUnit}>
                  <input
                    className={fieldClass}
                    type="number"
                    min="0.001"
                    step="any"
                    placeholder={field.placeholder || "Enter value in numbers"}
                    value={selectedSpecs[field.key] ?? ""}
                    onChange={(event) => handleSpecChange(field.key, event.target.value)}
                  />
                </LeadField>
              );
            }

            if (field.type === "file") {
              return (
                <LeadField key={field.key} label={field.label} className="md:col-span-2">
                  <DesignFilesField
                    files={
                      Array.isArray((selectedSpecs as Record<string, unknown>).designFiles)
                        ? ((selectedSpecs as Record<string, unknown>).designFiles as UploadedDesignFile[])
                        : []
                    }
                    onChange={handleFilesChange}
                  />
                </LeadField>
              );
            }

            return (
              <LeadField key={field.key} label={field.label}>
                <input
                  className={fieldClass}
                  type="text"
                  placeholder={field.placeholder || ""}
                  value={selectedSpecs[field.key] ?? ""}
                  onChange={(event) => handleSpecChange(field.key, event.target.value)}
                />
              </LeadField>
            );
          })
        ) : (
          <>
            {fallbackSelectorKeys.map((key) => (
              <LeadField key={key} label={specLabel(key)}>
                <CreatableSpecSelect
                  fieldName={key}
                  fieldLabel={specLabel(key)}
                  unit={specUnit(key)}
                  value={selectedSpecs[key] ?? ""}
                  onChange={(val) => setFallbackSpec(key, val)}
                  options={optionsFor(key)}
                  canCreate={canManageProducts}
                  categoryId={categoryId}
                  productId={parentProductId}
                  ariaLabel={`Select or add ${specLabel(key)}`}
                />
              </LeadField>
            ))}
            {fallbackCustomerInputFields.map(([key, configuredValue]) => {
              const unit = specUnit(key);
              return (
                <LeadField
                  key={key}
                  label={`${specLabel(key)}${unit ? ` (${unit})` : ""}`}
                >
                  <input
                    className={fieldClass}
                    type={NUMERIC_SPEC_KEYS.has(key) ? "number" : "text"}
                    min={NUMERIC_SPEC_KEYS.has(key) ? "0.001" : undefined}
                    step={NUMERIC_SPEC_KEYS.has(key) ? "any" : undefined}
                    value={selectedSpecs[key] ?? ""}
                    placeholder={String(configuredValue)}
                    onChange={(event) =>
                      setValue(`items.${index}.specifications`, {
                        ...selectedSpecs,
                        [key]: event.target.value,
                      })
                    }
                  />
                </LeadField>
              );
            })}
          </>
        )}

        {selectedParent && !isSpecComplete ? (
          <p className="text-xs text-muted md:col-span-4">
            Choose a complete specification combination that exists for{" "}
            {selectedParent.name}.
            {missingRequired.length > 0 ? (
              <span className="text-warning ml-1">
                (Missing: {missingRequired.join(", ")})
              </span>
            ) : null}
          </p>
        ) : null}

        <LeadField label="Quantity">
          <input
            className={fieldClass}
            {...register(`items.${index}.quantity`)}
          />
        </LeadField>
        <LeadField label="UOM">
          <input
            className={`${fieldClass} ${!isSpecComplete ? "bg-muted/50 cursor-not-allowed opacity-75" : ""}`}
            readOnly={!isSpecComplete}
            disabled={!isSpecComplete}
            value={isSpecComplete ? (uom || "") : "Select a valid specification"}
            onChange={(event) => {
              if (isSpecComplete) {
                setValue(`items.${index}.uom`, event.target.value);
              }
            }}
          />
        </LeadField>
        <LeadField label="Est. weight">
          <input
            className={`${fieldClass} ${!isSpecComplete ? "bg-muted/50 cursor-not-allowed opacity-75" : ""}`}
            placeholder="kg"
            disabled={!isSpecComplete}
            {...register(`items.${index}.estimatedWeight`)}
          />
        </LeadField>
        <LeadField label="Description" className="md:col-span-2">
          <input
            className={fieldClass}
            placeholder="Short description"
            {...register(`items.${index}.description`)}
          />
        </LeadField>
        <LeadField label="Remarks" className="md:col-span-2">
          <input
            className={fieldClass}
            placeholder="Optional"
            {...register(`items.${index}.remarks`)}
          />
        </LeadField>
      </div>
    </div>
  );
}

export function LeadCreateForm({
  customers,
  employees,
  products,
  categories,
  uoms,
  canManageProducts,
}: {
  customers: { id: string; name: string; code?: string }[];
  employees: { id: string; name: string }[];
  products: {
    id: string;
    name: string;
    sku: string;
    categoryId: string;
    categoryName: string;
    variants: {
      id: string;
      materialMasterId: string;
      sku: string;
      displayName: string;
      uom: string;
      specs: Record<string, unknown>;
    }[];
  }[];
  categories: { id: string; name: string }[];
  uoms: { id: string; symbol: string }[];
  canManageProducts: boolean;
}) {
  const { post, error, success, pending } = usePost();
  const defaultUom =
    uoms.find((uom) => uom.symbol === "PCS")?.symbol ??
    uoms[0]?.symbol ??
    "PCS";
  const form = useForm<FormValues>({
    defaultValues: {
      queryDate: todayStamp(),
      queryTime: nowTime(),
      contactPerson: "",
      contactDesignation: "",
      phone: "",
      email: "",
      address: "",
      companyName: "",
      customerId: "",
      source: "PHONE",
      priority: "normal",
      assigneeId: "",
      nextFollowUpAt: "",
      notes: "",
      requiredDeliveryDate: "",
      promisedDeliveryDate: "",
      customerRemarks: "",
      items: [emptyItem(defaultUom)],
      attendedById: "",
      result: "PENDING",
      resultReason: "",
      officeRemarks: "",
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const result = useWatch({ control: form.control, name: "result" });
  const priority = useWatch({ control: form.control, name: "priority" });
  const requiredDeliveryDate = useWatch({ control: form.control, name: "requiredDeliveryDate" });
  const promisedDeliveryDate = useWatch({ control: form.control, name: "promisedDeliveryDate" });
  const isPromisedLate = Boolean(
    requiredDeliveryDate &&
    promisedDeliveryDate &&
    promisedDeliveryDate > requiredDeliveryDate
  );

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => {
        const incompleteSelection = values.items.findIndex(
          (line) =>
            line.parentProductId && (!line.productVariantId || !line.productId),
        );
        if (incompleteSelection >= 0) {
          form.setError(`items.${incompleteSelection}.productVariantId`, {
            type: "validate",
            message: "Select a valid saved specification combination.",
          });
          return;
        }
        const mappedItems = values.items.map((line) => ({
          categoryId: line.categoryId || undefined,
          productId: line.productId || undefined,
          parentProductId: line.parentProductId || undefined,
          productVariantId: line.productVariantId || undefined,
          specifications: line.specifications,
          size: line.size || undefined,
          quantity: line.quantity,
          uom: line.uom,
          estimatedWeight: line.estimatedWeight || undefined,
          itemDescription: line.description || undefined,
          notes: line.remarks || undefined,
        }));
        const filledItems = mappedItems.filter(
          (line) => line.productId || line.itemDescription || line.size,
        );
        const noteParts = [
          values.notes.trim(),
          values.customerRemarks.trim(),
        ].filter(Boolean);

        return post(
          "/api/v1/leads",
          {
            queryDate: values.queryDate || undefined,
            queryTime:
              values.queryDate && values.queryTime
                ? `${values.queryDate}T${values.queryTime}`
                : undefined,
            contactPerson: values.contactPerson,
            contactDesignation: values.contactDesignation || undefined,
            customerName: values.contactPerson,
            phone: values.phone,
            email: values.email || undefined,
            address: values.address || undefined,
            companyName: values.companyName || undefined,
            customerId: values.customerId || undefined,
            source: values.source,
            priority: values.priority,
            assigneeId: values.assigneeId || undefined,
            nextFollowUpAt: values.nextFollowUpAt || undefined,
            notes: noteParts.join("\n\n") || undefined,
            requiredDeliveryDate: values.requiredDeliveryDate || undefined,
            promisedDeliveryDate: values.promisedDeliveryDate || undefined,
            attendedById: values.attendedById || undefined,
            result: values.result,
            resultReason: values.resultReason || undefined,
            officeRemarks: values.officeRemarks || undefined,
            items:
              filledItems.length > 0
                ? filledItems
                : [
                    {
                      quantity: "1",
                      uom: defaultUom,
                      itemDescription: "To be specified",
                    },
                  ],
          },
          { redirectTo: "/leads", successMessage: "Lead created." },
        );
      })}
    >
      <SectionCard
        step={1}
        title="Query & customer information"
        detail="Who is enquiring and how they reached you."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <LeadField label="Date">
            <input
              className={fieldClass}
              type="date"
              {...form.register("queryDate")}
            />
          </LeadField>
          <LeadField label="Time">
            <input
              className={fieldClass}
              type="time"
              {...form.register("queryTime")}
            />
          </LeadField>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <LeadField label="Contact person" required>
            <input
              className={fieldClass}
              placeholder="Full name"
              required
              {...form.register("contactPerson")}
            />
          </LeadField>
          <LeadField label="Designation">
            <input
              className={fieldClass}
              placeholder="e.g. Purchase Manager"
              {...form.register("contactDesignation")}
            />
          </LeadField>
          <LeadField label="Company / firm">
            <input
              className={fieldClass}
              placeholder="Company name"
              {...form.register("companyName")}
            />
          </LeadField>
          <LeadField label="Mobile" required>
            <input
              className={fieldClass}
              type="tel"
              placeholder="10-digit number"
              required
              {...form.register("phone")}
            />
          </LeadField>
          <LeadField label="Email">
            <input
              className={fieldClass}
              type="email"
              placeholder="name@company.com"
              {...form.register("email")}
            />
          </LeadField>
          <LeadField label="Link existing customer">
            <select className={fieldClass} {...form.register("customerId")}>
              <option value="">None</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code
                    ? `${customer.code} — ${customer.name}`
                    : customer.name}
                </option>
              ))}
            </select>
          </LeadField>
        </div>
        <div className="mt-4">
          <LeadField label="Address">
            <input
              className={fieldClass}
              placeholder="Street, city, state, pincode"
              {...form.register("address")}
            />
          </LeadField>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <LeadField label="Source">
            <select className={fieldClass} {...form.register("source")}>
              {LEAD_SOURCES.filter((source) => source !== "WEBSITE").map(
                (source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source] ?? source}
                  </option>
                ),
              )}
            </select>
          </LeadField>
          <LeadField label="Assign to">
            <select className={fieldClass} {...form.register("assigneeId")}>
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </LeadField>
          <LeadField label="Next follow-up">
            <input
              className={fieldClass}
              type="datetime-local"
              {...form.register("nextFollowUpAt")}
            />
          </LeadField>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-medium text-muted">Priority</p>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((value) => {
              const selected = priority === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => form.setValue("priority", value)}
                  className={`h-9 rounded-full px-4 text-sm font-medium capitalize transition ${
                    selected
                      ? "bg-info text-white"
                      : "border border-border bg-card text-foreground hover:border-info/40 hover:bg-info-soft"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4">
          <LeadField label="Internal notes">
            <textarea
              className={`${fieldClass} h-auto min-h-[88px] py-2.5`}
              placeholder="Anything this team should know…"
              {...form.register("notes")}
            />
          </LeadField>
        </div>
      </SectionCard>

      <SectionCard
        step={2}
        title="Requested materials & specifications"
        detail="What they need and the details that matter."
      >
        <div className="space-y-4">
          {fields.map((field, index) => (
            <LeadItemFields
              key={field.id}
              index={index}
              register={form.register}
              control={form.control}
              setValue={form.setValue}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              categories={categories}
              products={products}
              canManageProducts={canManageProducts}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-info hover:underline"
          onClick={() => append(emptyItem(defaultUom))}
        >
          <span className="flex size-6 items-center justify-center rounded-full border border-info text-info">
            <Plus className="size-3.5" strokeWidth={2.4} />
          </span>
          Add item
        </button>
      </SectionCard>

      <SectionCard
        step={3}
        title="Commercial & delivery"
        detail="Timeline and customer expectations."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <LeadField
            label="Required delivery date"
            detail="Customer's requested date"
          >
            <input
              className={fieldClass}
              type="date"
              {...form.register("requiredDeliveryDate")}
            />
          </LeadField>
          <LeadField
            label="Promised delivery date"
            detail="SS-Metals' confirmed commitment"
          >
            <input
              className={fieldClass}
              type="date"
              {...form.register("promisedDeliveryDate")}
            />
          </LeadField>
          {isPromisedLate ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300 md:col-span-2">
              <span className="font-semibold">Notice:</span> Promised delivery date ({promisedDeliveryDate}) is later than the customer&apos;s required delivery date ({requiredDeliveryDate}).
            </div>
          ) : null}
          <div className="md:col-span-2">
            <LeadField label="Customer remarks">
              <input
                className={fieldClass}
                placeholder="Special requests or terms"
                {...form.register("customerRemarks")}
              />
            </LeadField>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        step={4}
        title="Office use & follow-up"
        detail="Internal tracking only."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <LeadField label="Attended by">
            <select className={fieldClass} {...form.register("attendedById")}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </LeadField>
          <LeadField label="Result">
            <select className={fieldClass} {...form.register("result")}>
              <option value="PENDING">Pending</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
          </LeadField>
          {result === "FAILURE" ? (
            <LeadField label="Reason for no" required className="md:col-span-2">
              <select className={fieldClass} {...form.register("resultReason")}>
                <option value="">Select reason</option>
                <option value="Price">Price</option>
                <option value="Availability">Availability</option>
                <option value="Others">Others</option>
              </select>
            </LeadField>
          ) : null}
        </div>
        <div className="mt-4">
          <LeadField label="Office remarks">
            <input
              className={fieldClass}
              placeholder="Internal remarks"
              {...form.register("officeRemarks")}
            />
          </LeadField>
        </div>
      </SectionCard>

      <FormFeedback error={error} success={success} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          <span className="text-danger">*</span> Required field
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/leads" className="btn-secondary h-11 px-5">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-[10px] bg-info px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Create lead"}
          </button>
        </div>
      </div>
    </form>
  );
}
