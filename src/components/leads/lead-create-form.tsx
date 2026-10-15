"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { LEAD_SOURCES } from "@/modules/leads/status";

type FormValues = {
  customerName: string;
  phone: string;
  email: string;
  companyName: string;
  customerId: string;
  source: (typeof LEAD_SOURCES)[number];
  priority: "low" | "normal" | "high";
  assigneeId: string;
  nextFollowUpAt: string;
  notes: string;
  items: { itemDescription: string; productId: string; quantity: string; uom: string }[];
};

export function LeadCreateForm({
  customers,
  employees,
  products,
}: {
  customers: { id: string; name: string; code?: string }[];
  employees: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm<FormValues>({
    defaultValues: {
      customerName: "",
      phone: "",
      email: "",
      companyName: "",
      customerId: "",
      source: "PHONE",
      priority: "normal",
      assigneeId: "",
      nextFollowUpAt: "",
      notes: "",
      items: [{ itemDescription: "", productId: "", quantity: "1", uom: "PCS" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(
          "/api/v1/leads",
          {
            ...values,
            email: values.email || undefined,
            customerId: values.customerId || undefined,
            assigneeId: values.assigneeId || undefined,
            nextFollowUpAt: values.nextFollowUpAt || undefined,
            items: values.items.map((line) => ({
              itemDescription: line.itemDescription || undefined,
              productId: line.productId || undefined,
              quantity: line.quantity,
              uom: line.uom,
            })),
          },
          { redirectTo: "/leads", successMessage: "Lead created." },
        ),
      )}
    >
      <Field label="Customer name" required>
        <input className={controlClass} required {...form.register("customerName")} />
      </Field>
      <Field label="Phone" required>
        <input className={controlClass} required {...form.register("phone")} />
      </Field>
      <Field label="Email">
        <input className={controlClass} type="email" {...form.register("email")} />
      </Field>
      <Field label="Company">
        <input className={controlClass} {...form.register("companyName")} />
      </Field>
      <Field label="Link existing customer">
        <select className={controlClass} {...form.register("customerId")}>
          <option value="">None</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source" required>
        <select className={controlClass} {...form.register("source")}>
          {LEAD_SOURCES.filter((s) => s !== "WEBSITE").map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <select className={controlClass} {...form.register("priority")}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </Field>
      <Field label="Assign to">
        <select className={controlClass} {...form.register("assigneeId")}>
          <option value="">Unassigned</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Next follow-up">
        <input className={controlClass} type="datetime-local" {...form.register("nextFollowUpAt")} />
      </Field>
      <div className="md:col-span-2">
      <Field label="Notes">
        <textarea className={`${controlClass} min-h-[80px]`} {...form.register("notes")} />
      </Field>
      </div>

      <div className="md:col-span-2 space-y-3">
        <h2 className="font-semibold">Requested items</h2>
        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-4">
            <Field label="Product">
              <select className={controlClass} {...form.register(`items.${index}.productId`)}>
                <option value="">Free text below</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input className={controlClass} {...form.register(`items.${index}.itemDescription`)} />
            </Field>
            <Field label="Qty">
              <input className={controlClass} {...form.register(`items.${index}.quantity`)} />
            </Field>
            <Field label="UOM">
              <input className={controlClass} {...form.register(`items.${index}.uom`)} />
            </Field>
            {fields.length > 1 ? (
              <button type="button" className="text-sm text-danger md:col-span-4" onClick={() => remove(index)}>
                Remove line
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="btn-secondary text-sm" onClick={() => append({ itemDescription: "", productId: "", quantity: "1", uom: "PCS" })}>
          Add item
        </button>
      </div>

      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button type="submit" pending={pending}>
          Create lead
        </Button>
      </div>
    </form>
  );
}
