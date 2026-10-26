"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import {
  BUSINESS_KIND,
  BUSINESS_ROOTS,
  defaultSupplyModeForBusiness,
  type BusinessKind,
} from "@/lib/domain/business-categories";
import { MATERIAL_SPEC_FIELDS, type MaterialSpecKey } from "@/lib/domain/material-specifications";
import {
  FINISH_OPTIONS,
  GRADE_OPTIONS,
  MANUFACTURED_PRODUCT_TYPES,
  MANUFACTURED_SPEC_FIELDS,
  PVD_COLOUR_OPTIONS,
  TRADING_PRODUCT_TYPES,
  TRADING_SPEC_FIELDS,
  type ProductSpecificationKey,
} from "@/lib/domain/material-specifications";

export function MachineForm({
  departments,
  redirectTo = "/machines",
}: {
  departments: { id: string; name: string }[];
  redirectTo?: string;
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm({ defaultValues: { code: "", name: "", machineType: "slitting", departmentId: "", readingRequired: true } });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/machines", values, {
          redirectTo,
          successMessage: "Machine created successfully.",
        }),
      )}
    >
      <Field label="Code" required><input className={controlClass} required placeholder="SL-02" {...form.register("code")} /></Field>
      <Field label="Name" required><input className={controlClass} required placeholder="Slitter 2" {...form.register("name")} /></Field>
      <Field label="Type" required><input className={controlClass} required placeholder="slitting" {...form.register("machineType")} /></Field>
      <Field label="Department">
        <select className={controlClass} {...form.register("departmentId")}>
          <option value="">None</option>
          {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" {...form.register("readingRequired")} />
        Opening and closing readings are required
      </label>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>Create machine</Button>
      </div>
    </form>
  );
}

export function DieForm() {
  const { post, error, success, pending } = usePost();
  const form = useForm({ defaultValues: { code: "", name: "", dieType: "slitting", lifeLimit: "100000" } });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/dies", values, {
          redirectTo: "/dies",
          successMessage: "Die created successfully.",
        }),
      )}
    >
      <Field label="Code" required><input className={controlClass} required placeholder="DIE-02" {...form.register("code")} /></Field>
      <Field label="Name" required><input className={controlClass} required {...form.register("name")} /></Field>
      <Field label="Type" required><input className={controlClass} required placeholder="slitting" {...form.register("dieType")} /></Field>
      <Field label="Life limit"><input className={controlClass} {...form.register("lifeLimit")} /></Field>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>Create die</Button>
      </div>
    </form>
  );
}

type CategoryFormValues = {
  code: string;
  name: string;
  parentId: string;
  categoryType: "raw_material" | "wip" | "finished_goods" | "consumable" | "scrap";
  productForm: string;
  requiredSpecs: MaterialSpecKey[];
  description: string;
  status: "active" | "inactive";
};

export function CategoryForm({
  parents,
  categoryId,
  initial,
  redirectTo = "/categories",
  submitLabel = "Create category",
  isBusinessRoot = false,
}: {
  parents: { id: string; name: string; isBusinessRoot?: boolean; businessKind?: BusinessKind | null }[];
  categoryId?: string;
  initial?: Partial<CategoryFormValues>;
  redirectTo?: string;
  submitLabel?: string;
  isBusinessRoot?: boolean;
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm<CategoryFormValues>({
    defaultValues: {
      code: "",
      name: "",
      parentId: "",
      categoryType: "finished_goods",
      productForm: "",
      requiredSpecs: [],
      description: "",
      status: "active",
      ...initial,
    },
  });
  const url = categoryId ? `/api/v1/categories/${categoryId}` : "/api/v1/categories";
  const isEdit = Boolean(categoryId);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(url, values, {
          redirectTo,
          successMessage: isEdit ? "Category updated successfully." : "Category created successfully.",
        }),
      )}
    >
      <Field label="Business parent" required>
        <select className={controlClass} required={!isBusinessRoot} disabled={isBusinessRoot} {...form.register("parentId")}>
          <option value="">Select Trading or Manufactured…</option>
          {parents
            .filter((item) => item.isBusinessRoot)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          {parents.some((item) => !item.isBusinessRoot) ? (
            <optgroup label="Existing subcategories">
              {parents
                .filter((item) => !item.isBusinessRoot)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.businessKind === "trading"
                      ? "Trading"
                      : item.businessKind === "manufactured"
                        ? "Manufactured"
                        : "Other"}{" "}
                    · {item.name}
                  </option>
                ))}
            </optgroup>
          ) : null}
        </select>
      </Field>
      {isBusinessRoot ? (
        <p className="md:col-span-2 text-sm text-muted">
          This is a top-level business category. Products and subcategories sit under it; it cannot be renamed, reparented, or replaced.
        </p>
      ) : (
        <p className="md:col-span-2 text-sm text-muted">
          New categories must sit under Trading Products or Manufactured Products. Inventory type (raw, WIP, finished) is a subcategory, not a third business line.
        </p>
      )}
      <Field label="Category name" required>
        <input className={controlClass} required disabled={isBusinessRoot} {...form.register("name")} />
      </Field>
      <Field label="Category code" required>
        <input className={controlClass} required placeholder="UTN" disabled={isBusinessRoot} {...form.register("code")} />
      </Field>
      <Field label="Category type" required>
        <select className={controlClass} {...form.register("categoryType")}>
          <option value="raw_material">Raw material</option>
          <option value="wip">WIP / semi-finished</option>
          <option value="finished_goods">Finished goods</option>
          <option value="consumable">Consumable</option>
          <option value="scrap">Scrap & waste</option>
        </select>
      </Field>
      <Field label="Product form">
        <select className={controlClass} {...form.register("productForm")}>
          <option value="">Not set</option>
          <option value="coil">Coil</option>
          <option value="sheet">Sheet</option>
          <option value="circle">Circle</option>
          <option value="blank">Blank</option>
          <option value="wire">Wire</option>
          <option value="rod">Rod</option>
          <option value="pipe">Pipe</option>
          <option value="utensil">Utensil</option>
          <option value="component">Component</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-sm font-medium">Required material specifications</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MATERIAL_SPEC_FIELDS.map((spec) => (
            <label key={spec.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={spec.key} {...form.register("requiredSpecs")} />
              {spec.label}{spec.unit ? ` (${spec.unit})` : ""}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Status">
        <select className={controlClass} {...form.register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <input className={controlClass} {...form.register("description")} />
        </Field>
      </div>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}

const PRODUCT_NEW_CATEGORY = "__new_category__";
const PRODUCT_NEW_UNIT = "__new_unit__";

function defaultCategoryTypeForProduct(
  productType: "raw_material" | "semi_finished" | "finished" | "consumable",
) {
  switch (productType) {
    case "raw_material":
      return "raw_material";
    case "semi_finished":
      return "wip";
    case "consumable":
      return "consumable";
    default:
      return "finished_goods";
  }
}

type CatalogCategoryOption = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  requiredSpecs?: string[];
  businessKind: BusinessKind | null;
  isBusinessRoot: boolean;
};

export function ProductCreateForm({
  units,
  productId,
  initial,
  initialGrades,
  initialFinishes,
}: {
  units: { symbol: string; name: string }[];
  productId?: string;
  initial?: {
    businessKind: BusinessKind;
    name: string;
    sku: string;
    specs: Partial<Record<ProductSpecificationKey, string>>;
    baseUnitSymbol: string;
    description: string;
  };
  initialGrades?: { id: string; name: string }[];
  initialFinishes?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { post, error, success, pending } = usePost();
  const [grades, setGrades] = useState<{ id: string; name: string }[]>(initialGrades ?? []);
  const [finishes, setFinishes] = useState<{ id: string; name: string }[]>(initialFinishes ?? []);
  const [modalType, setModalType] = useState<"grade" | "finish" | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickPending, setQuickPending] = useState(false);

  useEffect(() => {
    if (!initialGrades) {
      fetch("/api/v1/masters/grades")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.grades) setGrades(data.grades);
        })
        .catch(() => {});
    }
    if (!initialFinishes) {
      fetch("/api/v1/masters/finishes")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.finishes) setFinishes(data.finishes);
        })
        .catch(() => {});
    }
  }, [initialGrades, initialFinishes]);

  const form = useForm({
    defaultValues: {
      businessKind: (initial?.businessKind ?? "") as BusinessKind | "",
      productType: initial?.businessKind === BUSINESS_KIND.trading
        ? TRADING_PRODUCT_TYPES.find((item) => item.label.toLowerCase() === initial.name.toLowerCase())?.value ?? ""
        : initial?.businessKind === BUSINESS_KIND.manufactured
          ? MANUFACTURED_PRODUCT_TYPES.find((item) => item.label.toLowerCase() === initial.name.toLowerCase())?.value ?? ""
          : "",
      name: initial?.name ?? "",
      sku: initial?.sku ?? "",
      specs: initial?.specs ?? {},
      baseUnitSymbol: initial?.baseUnitSymbol ?? units[0]?.symbol ?? "",
      description: initial?.description ?? "",
    },
  });
  const businessKind = useWatch({ control: form.control, name: "businessKind" });
  const productType = useWatch({ control: form.control, name: "productType" });
  const currentGrade = useWatch({ control: form.control, name: "specs.grade" });
  const currentFinish = useWatch({ control: form.control, name: "specs.finish" });

  const fields = businessKind === BUSINESS_KIND.trading
    ? TRADING_SPEC_FIELDS[productType || "other"]
    : businessKind === BUSINESS_KIND.manufactured
      ? MANUFACTURED_SPEC_FIELDS[productType || "other"]
      : [];

  const handleQuickAdd = async () => {
    setQuickError("");
    if (!quickName.trim()) {
      setQuickError(`${modalType === "grade" ? "Grade" : "Finish"} name is required.`);
      return;
    }
    setQuickPending(true);
    try {
      if (modalType === "grade") {
        const res = await post<{ grade: { id: string; name: string } }>(
          "/api/v1/masters/grades",
          { productId, name: quickName.trim(), description: quickDesc.trim() || undefined },
          { silent: true }
        );
        if (res?.grade) {
          setGrades((prev) => (prev.some((g) => g.id === res.grade.id) ? prev : [...prev, res.grade]));
          form.setValue("specs.grade", res.grade.name);
          setModalType(null);
          setQuickName("");
          setQuickDesc("");
        }
      } else if (modalType === "finish") {
        const res = await post<{ finish: { id: string; name: string } }>(
          "/api/v1/masters/finishes",
          { productId, name: quickName.trim(), description: quickDesc.trim() || undefined },
          { silent: true }
        );
        if (res?.finish) {
          setFinishes((prev) => (prev.some((f) => f.id === res.finish.id) ? prev : [...prev, res.finish]));
          form.setValue("specs.finish", res.finish.name);
          setModalType(null);
          setQuickName("");
          setQuickDesc("");
        }
      }
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setQuickPending(false);
    }
  };

  return (
    <>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(async (values) => {
        const saved = await post(productId ? `/api/v1/masters/catalog-products/${productId}` : "/api/v1/masters/catalog-products", {
          sku: values.sku.trim(),
          name: values.name.trim(),
          businessKind: values.businessKind,
          baseUnitSymbol: values.baseUnitSymbol,
          description: values.description.trim() || undefined,
          specs: Object.fromEntries(Object.entries(values.specs).filter(([, value]) => value.trim())),
        }, { silent: true, successMessage: "Product created successfully." });
        if (saved && typeof saved === "object" && "id" in saved && typeof saved.id === "string") {
          router.push(`/products/catalog/${saved.id}`);
        }
      })}>
        <Field label="Business Category" required>
          <select className={controlClass} required {...form.register("businessKind", {
            onChange: () => {
              form.setValue("productType", "");
              form.setValue("specs", {});
            },
          })}>
            <option value="">Select a category…</option>
            <option value={BUSINESS_KIND.trading}>Trading</option>
            <option value={BUSINESS_KIND.manufactured}>Manufactured</option>
          </select>
        </Field>
        <Field label="Product Name" required>
          <input
            className={controlClass}
            required
            list="supported-product-names"
            {...form.register("name", {
              onChange: (event) => {
                const value = event.target.value.trim().toLowerCase();
                const options = businessKind === BUSINESS_KIND.trading ? TRADING_PRODUCT_TYPES : MANUFACTURED_PRODUCT_TYPES;
                const match = options.find((item) => item.label.toLowerCase() === value);
                form.setValue("productType", match?.value ?? "other");
              },
            })}
          />
          <datalist id="supported-product-names">
            {(businessKind === BUSINESS_KIND.trading ? TRADING_PRODUCT_TYPES : MANUFACTURED_PRODUCT_TYPES).map((item) => (
              <option key={item.value} value={item.label} />
            ))}
          </datalist>
        </Field>
        <Field label="SKU / Product Code"><input className={controlClass} placeholder="Auto-generate if blank" {...form.register("sku")} /></Field>
        {fields.length ? (
          <fieldset className="md:col-span-2 grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-semibold">Dynamic Product Specifications</legend>
            {fields.map((field) => (
              <Field key={field.key} label={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}>
                {field.key === "grade" ? (
                  <select
                    className={controlClass}
                    value={currentGrade ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__ADD_NEW__") {
                        setModalType("grade");
                        setQuickName("");
                        setQuickDesc("");
                        setQuickError("");
                      } else {
                        form.setValue("specs.grade", val);
                      }
                    }}
                  >
                    <option value="">Select grade…</option>
                    <option value="__ADD_NEW__" className="font-semibold text-primary">
                      + Add New Grade
                    </option>
                    {grades.map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : field.key === "finish" ? (
                  <select
                    className={controlClass}
                    value={currentFinish ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__ADD_NEW__") {
                        setModalType("finish");
                        setQuickName("");
                        setQuickDesc("");
                        setQuickError("");
                      } else {
                        form.setValue("specs.finish", val);
                      }
                    }}
                  >
                    <option value="">Select finish…</option>
                    <option value="__ADD_NEW__" className="font-semibold text-primary">
                      + Add New Finish
                    </option>
                    {finishes.map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : field.key === "pvdColour" ? (
                  <select className={controlClass} {...form.register(`specs.${field.key}`)}>
                    <option value="">Select PVD colour…</option>
                    {PVD_COLOUR_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input className={controlClass} type={["thickness", "width", "length", "diameter", "netWeightKg", "innerDiameter", "outerDiameter", "height", "capacityLitres"].includes(field.key) ? "number" : "text"} min={0.001} step="any" {...form.register(`specs.${field.key}`)} />
                )}
              </Field>
            ))}
          </fieldset>
        ) : null}
        <Field label="Unit of Measurement" required>
          <select className={controlClass} required {...form.register("baseUnitSymbol")}>
            <option value="">Select a unit…</option>
            {units.map((unit) => <option key={unit.symbol} value={unit.symbol}>{unit.symbol} — {unit.name}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2"><Field label="Description / Additional Notes"><textarea className={controlClass} rows={3} {...form.register("description")} /></Field></div>
        <div className="md:col-span-2 space-y-3"><FormFeedback error={error} success={success} /><Button pending={pending}>{productId ? "Save changes" : "Create product"}</Button></div>
      </form>

      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-semibold text-foreground">
              Add New {modalType === "grade" ? "Grade" : "Finish"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This master value will be permanently registered and {productId ? "associated with this product" : "available for products"}.
            </p>
            {quickError && (
              <div className="mt-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                {quickError}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  {modalType === "grade" ? "Grade Name" : "Finish Name"} <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder={modalType === "grade" ? "e.g., SS 304, SS 316L" : "e.g., 2B, BA, No. 4, Mirror"}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional notes or standard"
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                disabled={quickPending}
                className="h-8 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={quickPending}
                className="h-8 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {quickPending ? "Saving…" : "Save & Select"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LegacyProductCreateForm({
  categories,
  units,
}: {
  categories: CatalogCategoryOption[];
  units: { symbol: string; name: string }[];
}) {
  const router = useRouter();
  const { post, error, success, pending } = usePost();
  const tradingRoot = categories.find((item) => item.isBusinessRoot && item.businessKind === BUSINESS_KIND.trading);
  const manufacturedRoot = categories.find((item) => item.isBusinessRoot && item.businessKind === BUSINESS_KIND.manufactured);
  const defaultKind: BusinessKind = manufacturedRoot ? BUSINESS_KIND.manufactured : BUSINESS_KIND.trading;
  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      businessKind: defaultKind,
      categoryId: "",
      newCategoryCode: "",
      newCategoryName: "",
      newCategoryType: "finished_goods" as
        | "raw_material"
        | "wip"
        | "finished_goods"
        | "consumable"
        | "scrap",
      productType: "finished" as "raw_material" | "semi_finished" | "finished" | "consumable",
      supplyMode: defaultSupplyModeForBusiness(defaultKind) as "purchased" | "manufactured" | "both",
      baseUnitSymbol: units[0]?.symbol ?? PRODUCT_NEW_UNIT,
      newUnitSymbol: "",
      newUnitName: "",
      newUnitType: "count" as "weight" | "count" | "length",
      description: "",
      grade: "",
      thickness: "",
      width: "",
      length: "",
      diameter: "",
      weightPerPiece: "",
      newCategoryRequiredSpecs: [] as MaterialSpecKey[],
    },
  });
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const businessKind = useWatch({ control: form.control, name: "businessKind" }) ?? defaultKind;
  const baseUnitSymbol = useWatch({ control: form.control, name: "baseUnitSymbol" });
  const productType = useWatch({ control: form.control, name: "productType" });
  const newCategory = categoryId === PRODUCT_NEW_CATEGORY;
  const newUnit = baseUnitSymbol === PRODUCT_NEW_UNIT;
  const newCategoryRequiredSpecs = useWatch({ control: form.control, name: "newCategoryRequiredSpecs" }) ?? [];
  const visibleCategories = categories.filter(
    (item) => !item.isBusinessRoot && item.businessKind === businessKind,
  );
  const businessRoot = businessKind === BUSINESS_KIND.trading ? tradingRoot : manufacturedRoot;
  const categoryRequiredSpecs = newCategory
    ? newCategoryRequiredSpecs
    : categories.find((item) => item.id === categoryId)?.requiredSpecs ?? [];

  if (!tradingRoot && !manufacturedRoot) {
    return (
      <p className="rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-warning">
        Trading Products and Manufactured Products are not set up yet. Run the business-category ensure step, then return to this form.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const body: Record<string, unknown> = {
          sku: values.sku.trim(),
          name: values.name.trim(),
          productType: values.productType,
          supplyMode: values.supplyMode,
          description: values.description.trim() || undefined,
          grade: values.grade.trim() || undefined,
          thickness: values.thickness || undefined,
          width: values.width || undefined,
          length: values.length || undefined,
          diameter: values.diameter || undefined,
          weightPerPiece: values.weightPerPiece || undefined,
        };
        if (values.categoryId === PRODUCT_NEW_CATEGORY) {
          body.newCategory = {
            code: values.newCategoryCode.trim(),
            name: values.newCategoryName.trim(),
            categoryType: values.newCategoryType,
            requiredSpecs: values.newCategoryRequiredSpecs,
            parentId: businessRoot?.id,
          };
        } else {
          body.categoryId = values.categoryId || businessRoot?.id;
        }
        if (values.baseUnitSymbol === PRODUCT_NEW_UNIT) {
          body.newUnit = {
            symbol: values.newUnitSymbol.trim(),
            name: values.newUnitName.trim(),
            unitType: values.newUnitType,
          };
        } else {
          body.baseUnitSymbol = values.baseUnitSymbol;
        }

        const created = await post("/api/v1/masters/catalog-products", body, {
          silent: true,
          successMessage: "Product created successfully.",
        });
        if (!created) return;
        if (typeof created === "object" && "id" in created && typeof created.id === "string") {
          router.push(`/products/catalog/${created.id}`);
        } else {
          router.push("/products?tab=products");
        }
      })}
    >
      <Field label="Business category" required>
        <select
          className={controlClass}
          required
          {...form.register("businessKind", {
            onChange: (event) => {
              const kind = event.target.value as BusinessKind;
              form.setValue("supplyMode", defaultSupplyModeForBusiness(kind));
              form.setValue("productType", kind === "trading" ? "raw_material" : "finished");
              form.setValue("categoryId", "");
            },
          })}
        >
          <option value={BUSINESS_KIND.trading}>Trading</option>
          <option value={BUSINESS_KIND.manufactured}>Manufactured</option>
        </select>
      </Field>
      <Field label="Product name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="SKU / product code">
        <input className={controlClass} placeholder="Auto if blank" {...form.register("sku")} />
      </Field>
      <Field label="Subcategory" required>
        <select className={controlClass} required {...form.register("categoryId")}>
          <option value={businessRoot?.id ?? ""}>
            {businessKind === "trading" ? "Trading Products (general)" : "Manufactured Products (general)"}
          </option>
          {visibleCategories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code})
            </option>
          ))}
          <option value={PRODUCT_NEW_CATEGORY}>+ Add subcategory under this business line…</option>
        </select>
      </Field>
      {newCategory ? (
        <>
          <Field label="New category name" required>
            <input className={controlClass} required {...form.register("newCategoryName")} />
          </Field>
          <Field label="New category code" required>
            <input className={controlClass} required placeholder="FG-UTENSILS" {...form.register("newCategoryCode")} />
          </Field>
          <Field label="New category type" required>
            <select
              className={controlClass}
              {...form.register("newCategoryType")}
              defaultValue={defaultCategoryTypeForProduct(productType ?? "finished")}
            >
              <option value="raw_material">Raw material</option>
              <option value="wip">WIP / semi-finished</option>
              <option value="finished_goods">Finished goods</option>
              <option value="consumable">Consumable</option>
              <option value="scrap">Scrap & waste</option>
            </select>
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-medium">Required material specifications</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MATERIAL_SPEC_FIELDS.map((spec) => (
                <label key={spec.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={spec.key} {...form.register("newCategoryRequiredSpecs")} />
                  {spec.label}{spec.unit ? ` (${spec.unit})` : ""}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      <Field label="Product type" required>
        <select className={controlClass} {...form.register("productType")}>
          <option value="raw_material">Raw material</option>
          <option value="semi_finished">Semi-finished</option>
          <option value="finished">Finished</option>
          <option value="consumable">Consumable</option>
        </select>
      </Field>
      <Field label="Supply mode" required>
        <select className={controlClass} {...form.register("supplyMode")}>
          {businessKind === "trading" ? (
            <>
              <option value="purchased">Purchased and resold</option>
              <option value="both">Usually purchased, sometimes processed</option>
            </>
          ) : (
            <>
              <option value="manufactured">Manufactured in factory</option>
              <option value="both">Usually manufactured, sometimes bought in</option>
            </>
          )}
        </select>
      </Field>
      <Field label="Unit of measure" required>
        <select className={controlClass} required {...form.register("baseUnitSymbol")}>
          {units.map((unit) => (
            <option key={unit.symbol} value={unit.symbol}>
              {unit.symbol} — {unit.name}
            </option>
          ))}
          <option value={PRODUCT_NEW_UNIT}>+ Add new unit…</option>
        </select>
      </Field>
      {newUnit ? (
        <>
          <Field label="New unit symbol" required>
            <input className={controlClass} required placeholder="BOX" {...form.register("newUnitSymbol")} />
          </Field>
          <Field label="New unit name" required>
            <input className={controlClass} required placeholder="Box" {...form.register("newUnitName")} />
          </Field>
          <Field label="New unit type" required>
            <select className={controlClass} {...form.register("newUnitType")}>
              <option value="weight">Weight</option>
              <option value="count">Count</option>
              <option value="length">Length</option>
            </select>
          </Field>
        </>
      ) : null}
      <div className="md:col-span-2">
        {categoryRequiredSpecs.length ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {MATERIAL_SPEC_FIELDS.filter((spec) => categoryRequiredSpecs.includes(spec.key)).map((spec) => (
              <Field key={spec.key} label={`${spec.label}${spec.unit ? ` (${spec.unit})` : ""}`} required>
                <input className={controlClass} required {...form.register(spec.key)} />
              </Field>
            ))}
          </div>
        ) : null}
        <Field label="Description">
          <input className={controlClass} {...form.register("description")} />
        </Field>
      </div>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>Create product</Button>
      </div>
    </form>
  );
}

export function MaterialForm({
  categories,
  units,
  productId,
  initial,
  redirectTo = "/products?tab=products",
  submitLabel = "Create stock SKU",
}: {
  categories: CatalogCategoryOption[];
  units: { symbol: string; name: string }[];
  productId?: string;
  initial?: Record<string, unknown>;
  redirectTo?: string;
  submitLabel?: string;
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm({
    defaultValues: {
      name: "",
      code: "",
      categoryId: "",
      productType: "finished" as "raw_material" | "semi_finished" | "finished" | "consumable",
      shape: "product",
      description: "",
      grade: "",
      thickness: "",
      width: "",
      length: "",
      diameter: "",
      weightPerPiece: "",
      uom: "",
      batchTracking: true,
      purchaseAllowed: true,
      salesAllowed: true,
      manufacturingAllowed: true,
      status: "active" as "active" | "inactive",
      ...initial,
    },
  });
  const selectedUom = form.watch("uom");
  const selectedCategoryId = form.watch("categoryId");
  const requiredSpecs = categories.find((item) => item.id === selectedCategoryId)?.requiredSpecs ?? [];
  const url = productId ? `/api/v1/masters/materials/${productId}` : "/api/v1/masters/materials";
  const isEdit = Boolean(productId);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(url, values, {
          redirectTo,
          successMessage: isEdit ? "Product updated successfully." : "Product created successfully.",
        }),
      )}
    >
      <Field label="Product name" required><input className={controlClass} required {...form.register("name")} /></Field>
      <Field label="SKU / code"><input className={controlClass} placeholder="Auto if blank" {...form.register("code")} /></Field>
      <Field label="Category">
        <select className={controlClass} {...form.register("categoryId")}>
          <option value="">Select category</option>
          <optgroup label={BUSINESS_ROOTS.trading.name}>
            {categories
              .filter((item) => item.businessKind === "trading")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.isBusinessRoot ? item.name : item.name} ({item.code})
                </option>
              ))}
          </optgroup>
          <optgroup label={BUSINESS_ROOTS.manufactured.name}>
            {categories
              .filter((item) => item.businessKind === "manufactured")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
          </optgroup>
        </select>
      </Field>
      <Field label="Product type" required>
        <select className={controlClass} {...form.register("productType")}>
          <option value="raw_material">Raw material</option>
          <option value="semi_finished">Semi-finished</option>
          <option value="finished">Finished</option>
          <option value="consumable">Consumable</option>
        </select>
      </Field>
      <Field label="Form / shape" required><input className={controlClass} required {...form.register("shape")} /></Field>
      <Field label="Stock UOM">
        <select className={controlClass} {...form.register("uom")}>
          <option value="">Select unit</option>
          {units.map((unit) => (
            <option key={unit.symbol} value={unit.symbol}>
              {unit.symbol} — {unit.name}
            </option>
          ))}
          {selectedUom && !units.some((unit) => unit.symbol === selectedUom) ? (
            <option value={selectedUom}>{selectedUom} (current)</option>
          ) : null}
        </select>
      </Field>
      {MATERIAL_SPEC_FIELDS.map((spec) => (
        <Field key={spec.key} label={`${spec.label}${spec.unit ? ` (${spec.unit})` : ""}`} required={requiredSpecs.includes(spec.key)}>
          <input className={controlClass} required={requiredSpecs.includes(spec.key)} {...form.register(spec.key)} />
        </Field>
      ))}
      <div className="md:col-span-2">
        <Field label="Description"><input className={controlClass} {...form.register("description")} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("batchTracking")} />
        Batch tracking
      </label>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}

export function CustomerForm() {
  const { post, error, success, pending } = usePost();
  const form = useForm({ defaultValues: { code: "", name: "", phone: "" } });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/dispatch/customers", values, {
          redirectTo: "/dispatch",
          successMessage: "Customer created successfully.",
        }),
      )}
    >
      <Field label="Code" required><input className={controlClass} required {...form.register("code")} /></Field>
      <Field label="Name" required><input className={controlClass} required {...form.register("name")} /></Field>
      <Field label="Phone"><input className={controlClass} {...form.register("phone")} /></Field>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>Create customer</Button>
      </div>
    </form>
  );
}
