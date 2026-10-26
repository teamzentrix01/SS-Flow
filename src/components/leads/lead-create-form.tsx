"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useFieldArray, useForm, useWatch, type UseFormRegister, type UseFormSetValue, type Control } from "react-hook-form";
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
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
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

function LeadItemFields({
  index,
  register,
  control,
  setValue,
  canRemove,
  onRemove,
  categories,
  products,
  uoms,
  canManageProducts,
}: {
  index: number;
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  canRemove: boolean;
  onRemove: () => void;
  categories: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; categoryId: string; categoryName: string; variants: { id: string; materialMasterId: string; sku: string; displayName: string; uom: string; specs: Record<string, unknown> }[] }[];
  uoms: { id: string; symbol: string }[];
  canManageProducts: boolean;
}) {
  const [productSearch, setProductSearch] = useState("");
  const categoryId = useWatch({ control, name: `items.${index}.categoryId` });
  const parentProductId = useWatch({ control, name: `items.${index}.parentProductId` });
  const selectedVariantId = useWatch({ control, name: `items.${index}.productVariantId` });
  const selectedSpecs = useWatch({ control, name: `items.${index}.specifications` }) ?? {};
  const uom = useWatch({ control, name: `items.${index}.uom` });
  const visibleProducts = products.filter((product) => (!categoryId || product.categoryId === categoryId) && `${product.name} ${product.sku}`.toLowerCase().includes(productSearch.trim().toLowerCase()));
  const selectedParent = products.find((product) => product.id === parentProductId);
  const variants = selectedParent?.variants ?? [];
  const hiddenKeys = new Set(["categoryId", "categoryName", "productId", "productName", "productSku", "productVariantId", "variantDisplayName"]);
  const specOrder = ["grade", "finish", "thickness", "width", "length", "diameter"];
  const specKeys = [...new Set(variants.flatMap((variant) => Object.entries(variant.specs).filter(([key, value]) => !hiddenKeys.has(key) && value !== null && value !== undefined && value !== "").map(([key]) => key)))].sort((a, b) => {
    const ai = specOrder.indexOf(a); const bi = specOrder.indexOf(b);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.localeCompare(b);
  });
  const specLabel = (key: string) => ({ grade: "Grade", finish: "Finish", thickness: "Thickness", width: "Width", length: "Length", diameter: "Diameter" }[key] ?? key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()));
  const optionsFor = (key: string) => [...new Set(variants.filter((variant) => Object.entries(selectedSpecs).every(([selectedKey, value]) => selectedKey === key || !value || String(variant.specs[selectedKey] ?? "") === value)).map((variant) => variant.specs[key]).filter((value) => value !== null && value !== undefined && value !== "").map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const setSpec = (key: string, value: string) => {
    const values = { ...selectedSpecs };
    const keyIndex = specKeys.indexOf(key);
    for (const laterKey of specKeys.slice(keyIndex + 1)) delete values[laterKey];
    if (value) values[key] = value;
    else delete values[key];
    setValue(`items.${index}.specifications`, values);
    const matches = variants.filter((variant) => specKeys.every((specKey) => String(variant.specs[specKey] ?? "") === String(values[specKey] ?? "")));
    const exact = matches.length === 1 ? matches[0] : undefined;
    setValue(`items.${index}.productVariantId`, exact?.id ?? "");
    setValue(`items.${index}.productId`, exact?.materialMasterId ?? "");
    setValue(`items.${index}.uom`, exact?.uom ?? "");
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Item {index + 1}</p>
        {canRemove ? (
          <button type="button" className="text-sm font-medium text-danger hover:underline" onClick={onRemove}>
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
          <input className={`${fieldClass} mb-1`} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product or specification" aria-label="Search product variants" />
          <select className={fieldClass} {...register(`items.${index}.parentProductId`, { onChange: (event) => {
            setValue(`items.${index}.productVariantId`, "");
            setValue(`items.${index}.productId`, "");
            setValue(`items.${index}.specifications`, {});
            setValue(`items.${index}.uom`, "");
            const parent = products.find((product) => product.id === event.target.value);
            if (parent?.variants.length === 1) {
              const variant = parent.variants[0];
              setValue(`items.${index}.productVariantId`, variant.id);
              setValue(`items.${index}.productId`, variant.materialMasterId);
              setValue(`items.${index}.uom`, variant.uom);
              setValue(`items.${index}.specifications`, Object.fromEntries(Object.entries(variant.specs).filter(([, value]) => value != null && typeof value !== "object").map(([key, value]) => [key, String(value)])));
            }
          }})}>
            <option value="">Select</option>
            {visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            {!visibleProducts.length ? <option value="" disabled>No matching products</option> : null}
          </select>
          {selectedParent && !variants.length ? <p className="mt-1 text-xs text-muted">No specifications available for this product. Please add specifications in Product Master.{canManageProducts ? <> <Link className="font-medium text-accent underline" href={`/products/catalog/${selectedParent.id}`}>Manage specifications</Link></> : null}</p> : null}
        </LeadField>
        {specKeys.map((key) => <LeadField key={key} label={specLabel(key)}>
          <select className={fieldClass} value={selectedSpecs[key] ?? ""} onChange={(event) => setSpec(key, event.target.value)}>
            <option value="">Select</option>
            {optionsFor(key).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </LeadField>)}
        {selectedParent && variants.length > 1 && !selectedVariantId ? <p className="text-xs text-muted md:col-span-4">Choose a complete specification combination that exists for {selectedParent.name}.</p> : null}
        <LeadField label="Quantity">
          <input className={fieldClass} {...register(`items.${index}.quantity`)} />
        </LeadField>
        <LeadField label="UOM"><input className={fieldClass} readOnly value={uom || "Select a valid specification"} /></LeadField>
        <LeadField label="Est. weight">
          <input className={fieldClass} placeholder="kg" {...register(`items.${index}.estimatedWeight`)} />
        </LeadField>
        <LeadField label="Description" className="md:col-span-2">
          <input className={fieldClass} placeholder="Short description" {...register(`items.${index}.description`)} />
        </LeadField>
        <LeadField label="Remarks" className="md:col-span-2">
          <input className={fieldClass} placeholder="Optional" {...register(`items.${index}.remarks`)} />
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
  products: { id: string; name: string; sku: string; categoryId: string; categoryName: string; variants: { id: string; materialMasterId: string; sku: string; displayName: string; uom: string; specs: Record<string, unknown> }[] }[];
  categories: { id: string; name: string }[];
  uoms: { id: string; symbol: string }[];
  canManageProducts: boolean;
}) {
  const { post, error, success, pending } = usePost();
  const defaultUom = uoms.find((uom) => uom.symbol === "PCS")?.symbol ?? uoms[0]?.symbol ?? "PCS";
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
      customerRemarks: "",
      items: [emptyItem(defaultUom)],
      attendedById: "",
      result: "PENDING",
      resultReason: "",
      officeRemarks: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const result = useWatch({ control: form.control, name: "result" });
  const priority = useWatch({ control: form.control, name: "priority" });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => {
        const incompleteSelection = values.items.findIndex((line) => line.parentProductId && (!line.productVariantId || !line.productId));
        if (incompleteSelection >= 0) {
          form.setError(`items.${incompleteSelection}.productVariantId`, { type: "validate", message: "Select a valid saved specification combination." });
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
        const noteParts = [values.notes.trim(), values.customerRemarks.trim()].filter(Boolean);

        return post(
          "/api/v1/leads",
          {
            queryDate: values.queryDate || undefined,
            queryTime: values.queryDate && values.queryTime ? `${values.queryDate}T${values.queryTime}` : undefined,
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
            attendedById: values.attendedById || undefined,
            result: values.result,
            resultReason: values.resultReason || undefined,
            officeRemarks: values.officeRemarks || undefined,
            items:
              filledItems.length > 0
                ? filledItems
                : [{ quantity: "1", uom: defaultUom, itemDescription: "To be specified" }],
          },
          { redirectTo: "/leads", successMessage: "Lead created." },
        );
      })}
    >
      <SectionCard step={1} title="Query & customer information" detail="Who is enquiring and how they reached you.">
        <div className="grid gap-4 md:grid-cols-3">
          <LeadField label="Date">
            <input className={fieldClass} type="date" {...form.register("queryDate")} />
          </LeadField>
          <LeadField label="Time">
            <input className={fieldClass} type="time" {...form.register("queryTime")} />
          </LeadField>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <LeadField label="Contact person" required>
            <input className={fieldClass} placeholder="Full name" required {...form.register("contactPerson")} />
          </LeadField>
          <LeadField label="Designation">
            <input className={fieldClass} placeholder="e.g. Purchase Manager" {...form.register("contactDesignation")} />
          </LeadField>
          <LeadField label="Company / firm">
            <input className={fieldClass} placeholder="Company name" {...form.register("companyName")} />
          </LeadField>
          <LeadField label="Mobile" required>
            <input className={fieldClass} type="tel" placeholder="10-digit number" required {...form.register("phone")} />
          </LeadField>
          <LeadField label="Email">
            <input className={fieldClass} type="email" placeholder="name@company.com" {...form.register("email")} />
          </LeadField>
          <LeadField label="Link existing customer">
            <select className={fieldClass} {...form.register("customerId")}>
              <option value="">None</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code ? `${customer.code} — ${customer.name}` : customer.name}
                </option>
              ))}
            </select>
          </LeadField>
        </div>
        <div className="mt-4">
          <LeadField label="Address">
            <input className={fieldClass} placeholder="Street, city, state, pincode" {...form.register("address")} />
          </LeadField>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <LeadField label="Source">
            <select className={fieldClass} {...form.register("source")}>
              {LEAD_SOURCES.filter((source) => source !== "WEBSITE").map((source) => (
                <option key={source} value={source}>
                  {SOURCE_LABELS[source] ?? source}
                </option>
              ))}
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
            <input className={fieldClass} type="datetime-local" {...form.register("nextFollowUpAt")} />
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

      <SectionCard step={2} title="Requested materials & specifications" detail="What they need and the details that matter.">
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
              uoms={uoms}
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

      <SectionCard step={3} title="Commercial & delivery" detail="Timeline and customer expectations.">
        <div className="grid gap-4 md:grid-cols-2">
          <LeadField label="Required delivery date">
            <input className={fieldClass} type="date" {...form.register("requiredDeliveryDate")} />
          </LeadField>
          <LeadField label="Customer remarks">
            <input className={fieldClass} placeholder="Special requests or terms" {...form.register("customerRemarks")} />
          </LeadField>
        </div>
      </SectionCard>

      <SectionCard step={4} title="Office use & follow-up" detail="Internal tracking only.">
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
            <input className={fieldClass} placeholder="Internal remarks" {...form.register("officeRemarks")} />
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
