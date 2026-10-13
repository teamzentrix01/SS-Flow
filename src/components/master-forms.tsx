"use client";

import { useForm } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";

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
          <option value="utensil">Utensil</option>
          <option value="component">Component</option>
          <option value="other">Other</option>
        </select>
      </Field>
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

export function MaterialForm({
  categories,
  productId,
  initial,
  redirectTo = "/products",
  submitLabel = "Create product",
}: {
  categories: { id: string; name: string; code: string }[];
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
      uom: "",
      batchTracking: true,
      purchaseAllowed: true,
      salesAllowed: true,
      manufacturingAllowed: true,
      status: "active" as "active" | "inactive",
      ...initial,
    },
  });
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
      <Field label="Stock UOM"><input className={controlClass} placeholder="PCS or KG" {...form.register("uom")} /></Field>
      <Field label="Grade"><input className={controlClass} {...form.register("grade")} /></Field>
      <Field label="Thickness mm"><input className={controlClass} {...form.register("thickness")} /></Field>
      <Field label="Width mm"><input className={controlClass} {...form.register("width")} /></Field>
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
