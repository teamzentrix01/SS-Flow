"use client";

import { useForm } from "react-hook-form";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>;
}

export function MachineForm({ departments }: { departments: { id: string; name: string }[] }) {
  const { post, error, pending } = usePost();
  const form = useForm({ defaultValues: { code: "", name: "", machineType: "slitting", departmentId: "", readingRequired: true } });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => post("/api/v1/machines", values, "/machines"))}>
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
      <div className="md:col-span-2 space-y-3"><ErrorText error={error} /><Button pending={pending}>Create machine</Button></div>
    </form>
  );
}

export function DieForm() {
  const { post, error, pending } = usePost();
  const form = useForm({ defaultValues: { code: "", name: "", dieType: "slitting", lifeLimit: "100000" } });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => post("/api/v1/dies", values, "/dies"))}>
      <Field label="Code" required><input className={controlClass} required placeholder="DIE-02" {...form.register("code")} /></Field>
      <Field label="Name" required><input className={controlClass} required {...form.register("name")} /></Field>
      <Field label="Type" required><input className={controlClass} required placeholder="slitting" {...form.register("dieType")} /></Field>
      <Field label="Life limit"><input className={controlClass} {...form.register("lifeLimit")} /></Field>
      <div className="md:col-span-2 space-y-3"><ErrorText error={error} /><Button pending={pending}>Create die</Button></div>
    </form>
  );
}

export function MaterialForm() {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      name: "",
      category: "utensil" as "raw" | "semi" | "utensil" | "consumable",
      shape: "product",
      grade: "",
      thickness: "",
      width: "",
      uom: "",
    },
  });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => post("/api/v1/masters/materials", values, "/masters/products"))}>
      <Field label="Name" required><input className={controlClass} {...form.register("name")} /></Field>
      <Field label="Category" required>
        <select className={controlClass} {...form.register("category")}>
          <option value="utensil">Utensil (finished)</option>
          <option value="raw">Raw material</option>
          <option value="semi">Semi-finished</option>
          <option value="consumable">Consumable</option>
        </select>
      </Field>
      <Field label="Shape" required><input className={controlClass} {...form.register("shape")} /></Field>
      <Field label="Grade"><input className={controlClass} {...form.register("grade")} /></Field>
      <Field label="Thickness mm"><input className={controlClass} {...form.register("thickness")} /></Field>
      <Field label="Width mm"><input className={controlClass} {...form.register("width")} /></Field>
      <Field label="UOM (optional)"><input className={controlClass} placeholder="PCS or KG" {...form.register("uom")} /></Field>
      <div className="md:col-span-2 space-y-3"><ErrorText error={error} /><Button pending={pending}>Create product</Button></div>
    </form>
  );
}

export function CustomerForm() {
  const { post, error, pending } = usePost();
  const form = useForm({ defaultValues: { name: "", phone: "" } });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => post("/api/v1/dispatch/customers", values, "/dispatch"))}>
      <Field label="Customer name" required><input className={controlClass} required {...form.register("name")} /></Field>
      <Field label="Phone"><input className={controlClass} {...form.register("phone")} /></Field>
      <div className="md:col-span-2 space-y-3"><ErrorText error={error} /><Button pending={pending}>Create customer</Button></div>
    </form>
  );
}
