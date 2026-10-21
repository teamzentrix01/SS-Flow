"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { MATERIAL_SPEC_FIELDS, type MaterialSpecKey } from "@/lib/domain/material-specifications";

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
}: {
  parents: { id: string; name: string }[];
  categoryId?: string;
  initial?: Partial<CategoryFormValues>;
  redirectTo?: string;
  submitLabel?: string;
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
      <Field label="Category name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="Category code" required>
        <input className={controlClass} required placeholder="UTN" {...form.register("code")} />
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
      <Field label="Parent category">
        <select className={controlClass} {...form.register("parentId")}>
          <option value="">None</option>
          {parents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
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

export function ProductCreateForm({
  categories,
  units,
}: {
  categories: { id: string; name: string; code: string; requiredSpecs?: string[] }[];
  units: { symbol: string; name: string }[];
}) {
  const router = useRouter();
  const { post, error, success, pending } = usePost();
  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      categoryId: categories[0]?.id ?? PRODUCT_NEW_CATEGORY,
      newCategoryCode: "",
      newCategoryName: "",
      newCategoryType: "finished_goods" as
        | "raw_material"
        | "wip"
        | "finished_goods"
        | "consumable"
        | "scrap",
      productType: "finished" as "raw_material" | "semi_finished" | "finished" | "consumable",
      supplyMode: "manufactured" as "purchased" | "manufactured" | "both",
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
  const baseUnitSymbol = useWatch({ control: form.control, name: "baseUnitSymbol" });
  const productType = useWatch({ control: form.control, name: "productType" });
  const newCategory = categoryId === PRODUCT_NEW_CATEGORY;
  const newUnit = baseUnitSymbol === PRODUCT_NEW_UNIT;
  const newCategoryRequiredSpecs = useWatch({ control: form.control, name: "newCategoryRequiredSpecs" }) ?? [];
  const categoryRequiredSpecs = newCategory
    ? newCategoryRequiredSpecs
    : categories.find((item) => item.id === categoryId)?.requiredSpecs ?? [];

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
          };
        } else {
          body.categoryId = values.categoryId;
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
      <Field label="Product name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="SKU / code" required>
        <input className={controlClass} required placeholder="e.g. SPOON-18CM" {...form.register("sku")} />
      </Field>
      <Field label="Category" required>
        <select className={controlClass} required {...form.register("categoryId")}>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code})
            </option>
          ))}
          <option value={PRODUCT_NEW_CATEGORY}>+ Add new category…</option>
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
          <option value="purchased">Purchased only</option>
          <option value="manufactured">Manufactured only</option>
          <option value="both">Purchased or manufactured</option>
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
  redirectTo = "/products?tab=variants",
  submitLabel = "Create stock SKU",
}: {
  categories: { id: string; name: string; code: string; requiredSpecs?: string[] }[];
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
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code})
            </option>
          ))}
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
