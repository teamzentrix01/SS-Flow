"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  useFieldArray,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";

const roleChoices = [
  { code: "operator", label: "Machine Operator" },
  { code: "supervisor", label: "Shift Supervisor" },
  { code: "qc", label: "Quality Inspector" },
  { code: "purchase", label: "Purchase Desk" },
  { code: "admin", label: "Plant Admin" },
] as const;

function PasswordField({
  label,
  registration,
  autoComplete = "current-password",
  required = false,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} required={required}>
      <div className="flex gap-2">
        <input
          className={controlClass}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          {...registration}
        />
        <button
          type="button"
          className="h-11 shrink-0 rounded-[10px] border border-border bg-card px-3 text-sm font-semibold"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}

export function LoginForm() {
  const { post, error, pending } = usePost();
  const form = useForm({ defaultValues: { email: "", password: "" } });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/auth/login", values, "/"),
      )}
    >
      <Field label="Email or employee ID" required>
        <input
          className={controlClass}
          autoComplete="username"
          {...form.register("email")}
        />
      </Field>
      <PasswordField label="Password" registration={form.register("password")} required />
      <ErrorText error={error} />
      <Button pending={pending}>Sign in</Button>
    </form>
  );
}

export function SupplierForm() {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: { name: "", contact: "", phone: "", email: "" },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/purchasing/suppliers", values),
      )}
    >
      <Field label="Name" required>
        <input className={controlClass} {...form.register("name")} />
      </Field>
      <Field label="Contact">
        <input className={controlClass} {...form.register("contact")} />
      </Field>
      <Field label="Phone">
        <input className={controlClass} {...form.register("phone")} />
      </Field>
      <Field label="Email">
        <input className={controlClass} {...form.register("email")} />
      </Field>
      <div className="md:col-span-2 space-y-3">
        <ErrorText error={error} />
        <Button pending={pending}>Save supplier</Button>
      </div>
    </form>
  );
}

type Line = {
  materialId: string;
  qty: string;
  rate: string;
  grade: string;
  thickness: string;
  width: string;
};

export function PurchaseForm({
  suppliers,
  materials,
}: {
  suppliers: { id: string; name: string }[];
  materials: { id: string; name: string }[];
}) {
  const { post, error, pending } = usePost();
  const form = useForm<{
    supplierId: string;
    expectedDate: string;
    notes: string;
    lines: Line[];
  }>({
    defaultValues: {
      supplierId: suppliers[0]?.id ?? "",
      lines: [
        {
          materialId: materials[0]?.id ?? "",
          qty: "",
          rate: "",
          grade: "",
          thickness: "",
          width: "",
        },
      ],
    },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/purchasing/orders", values, "/purchasing/orders"),
      )}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Supplier" required>
          <select className={controlClass} {...form.register("supplierId")}>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expected date">
          <input
            className={controlClass}
            type="date"
            {...form.register("expectedDate")}
          />
        </Field>
      </div>
      {lines.fields.map((field, index) => (
        <div
          key={field.id}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3"
        >
          <Field label="Material" required>
            <select
              className={controlClass}
              {...form.register(`lines.${index}.materialId`)}
            >
              {materials.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Qty kg" required>
            <input
              className={controlClass}
              {...form.register(`lines.${index}.qty`)}
            />
          </Field>
          <Field label="Rate" required>
            <input
              className={controlClass}
              {...form.register(`lines.${index}.rate`)}
            />
          </Field>
          <Field label="Grade">
            <input
              className={controlClass}
              {...form.register(`lines.${index}.grade`)}
            />
          </Field>
          <Field label="Thickness">
            <input
              className={controlClass}
              {...form.register(`lines.${index}.thickness`)}
            />
          </Field>
          <Field label="Width">
            <input
              className={controlClass}
              {...form.register(`lines.${index}.width`)}
            />
          </Field>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-medium text-steel"
        onClick={() =>
          lines.append({
            materialId: materials[0]?.id ?? "",
            qty: "",
            rate: "",
            grade: "",
            thickness: "",
            width: "",
          })
        }
      >
        Add line
      </button>
      <ErrorText error={error} />
      <Button pending={pending}>Create order</Button>
    </form>
  );
}

export function ReceiptForm({
  orderId,
  locations,
  lines,
}: {
  orderId: string;
  locations: { id: string; label: string }[];
  lines: { id: string; label: string }[];
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      orderId,
      locationId: locations[0]?.id ?? "",
      notes: "",
      lines: lines.map((line) => ({
        orderItemId: line.id,
        qty: "",
        batchNo: "",
        heatNo: "",
        grade: "",
        thickness: "",
        width: "",
      })),
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        post(
          "/api/v1/purchasing/receipts",
          {
            ...values,
            lines: values.lines.filter((line) => line.qty && line.batchNo),
          },
          `/purchasing/orders/${orderId}`,
        ),
      )}
    >
      <Field label="Location" required>
        <select className={controlClass} {...form.register("locationId")}>
          {locations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      {lines.map((line, index) => (
        <div
          key={line.id}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3"
        >
          <p className="md:col-span-3 font-medium">{line.label}</p>
          <input
            type="hidden"
            {...form.register(`lines.${index}.orderItemId`)}
          />
          <Field label="Received kg">
            <input
              className={controlClass}
              {...form.register(`lines.${index}.qty`)}
            />
          </Field>
          <Field label="Batch no">
            <input
              className={controlClass}
              {...form.register(`lines.${index}.batchNo`)}
            />
          </Field>
          <Field label="Heat">
            <input
              className={controlClass}
              {...form.register(`lines.${index}.heatNo`)}
            />
          </Field>
        </div>
      ))}
      <ErrorText error={error} />
      <Button pending={pending}>Post receipt</Button>
    </form>
  );
}

export function DecisionButtons({ id }: { id: string }) {
  const { post, error, pending } = usePost();
  const [remarks, setRemarks] = useState("");
  const decide = (decision: "pass" | "hold" | "fail" | "rework") => {
    if (
      (decision === "fail" || decision === "rework") &&
      !window.confirm(
        `Confirm ${decision}? This changes the production workflow.`,
      )
    )
      return;
    void post(
      `/api/v1/quality/inspections/${id}/decision`,
      { decision, remarks },
      "/quality",
    );
  };
  return (
    <div className="space-y-3">
      <Field label="Inspector remarks">
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          className={`${controlClass} h-24 py-2`}
          placeholder="Required for hold, fail, or rework"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {(["pass", "hold", "fail", "rework"] as const).map((decision) => (
          <button
            key={decision}
            type="button"
            disabled={pending}
            onClick={() => decide(decision)}
            className={`h-12 rounded-[10px] border text-sm font-semibold capitalize ${decision === "pass" ? "border-success bg-success-soft text-success" : decision === "fail" ? "border-danger bg-danger-soft text-danger" : "border-border bg-card"}`}
          >
            {decision}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function ProductionForm({
  products,
  batches,
}: {
  products: { id: string; name: string }[];
  batches: { id: string; label: string; locationId: string }[];
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      productId: products[0]?.id ?? "",
      sourceBatchId: batches[0]?.id ?? "",
      locationId: batches[0]?.locationId ?? "",
      inputQty: "",
      targetQty: "",
      priority: "normal",
    },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) => {
        const batch = batches.find((item) => item.id === values.sourceBatchId);
        return post(
          "/api/v1/production/orders",
          { ...values, locationId: batch?.locationId ?? values.locationId },
          "/production",
        );
      })}
    >
      <Field label="Product" required>
        <select className={controlClass} {...form.register("productId")}>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source batch" required>
        <select className={controlClass} {...form.register("sourceBatchId")}>
          {batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Input kg" required>
        <input className={controlClass} {...form.register("inputQty")} />
      </Field>
      <Field label="Target kg" required>
        <input className={controlClass} {...form.register("targetQty")} />
      </Field>
      <div className="md:col-span-2 space-y-3">
        <ErrorText error={error} />
        <Button pending={pending}>Create order</Button>
      </div>
    </form>
  );
}

export function JobCreateForm({
  products,
  batches,
}: {
  products: { id: string; name: string }[];
  batches: { id: string; label: string }[];
}) {
  const router = useRouter();
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      name: "Slitting",
      productId: products[0]?.id ?? "",
      sourceBatchId: batches[0]?.id ?? "",
      inputQty: "",
      targetQty: "",
    },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const created = (await post("/api/v1/jobs", values)) as {
          id: string;
        } | null;
        if (created?.id) router.push(`/jobs/${created.id}`);
      })}
    >
      <Field label="Job name" required>
        <input className={controlClass} {...form.register("name")} />
      </Field>
      <Field label="Product" required>
        <select className={controlClass} {...form.register("productId")}>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source batch">
        <select className={controlClass} {...form.register("sourceBatchId")}>
          <option value="">No batch yet</option>
          {batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Input kg">
        <input
          className={controlClass}
          placeholder="Reserved from the batch"
          {...form.register("inputQty")}
        />
      </Field>
      <Field label="Target kg" required>
        <input className={controlClass} {...form.register("targetQty")} />
      </Field>
      <div className="md:col-span-2 space-y-3">
        <ErrorText error={error} />
        <Button pending={pending}>Create job</Button>
      </div>
    </form>
  );
}

export function AssignForm({
  jobId,
  employees,
  machines,
  dies,
}: {
  jobId: string;
  employees: { id: string; name: string }[];
  machines: { id: string; name: string }[];
  dies: { id: string; name: string }[];
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      employeeId: employees[0]?.id ?? "",
      machineId: machines[0]?.id ?? "",
      dieId: "",
      plannedStart: "",
      plannedEnd: "",
    },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(`/api/v1/jobs/${jobId}/assign`, values, `/jobs/${jobId}`),
      )}
    >
      <Field label="Employee" required>
        <select className={controlClass} {...form.register("employeeId")}>
          {employees.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Machine" required>
        <select className={controlClass} {...form.register("machineId")}>
          {machines.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Die">
        <select className={controlClass} {...form.register("dieId")}>
          <option value="">None</option>
          {dies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Start">
        <input
          className={controlClass}
          type="datetime-local"
          {...form.register("plannedStart")}
        />
      </Field>
      <Field label="Deadline">
        <input
          className={controlClass}
          type="datetime-local"
          {...form.register("plannedEnd")}
        />
      </Field>
      <div className="md:col-span-2 space-y-3">
        <ErrorText error={error} />
        <Button pending={pending}>Assign job</Button>
      </div>
    </form>
  );
}

export function StartForm({ jobId }: { jobId: string }) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: { openingReading: "", confirmed: false },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        post(
          `/api/v1/jobs/${jobId}/start`,
          { openingReading: values.openingReading, confirmed: true },
          `/shop/jobs/${jobId}/active`,
        ),
      )}
    >
      <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <input type="checkbox" {...form.register("confirmed")} /> I checked the
        employee, machine, batch, die, and that the machine is free.
      </label>
      <Field label="Opening counter">
        <input className={controlClass} {...form.register("openingReading")} />
      </Field>
      <ErrorText error={error} />
      <Button pending={pending}>Start job</Button>
    </form>
  );
}

export function SubmitForm({ jobId }: { jobId: string }) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      goodQty: "0",
      rejectQty: "0",
      scrapQty: "0",
      consumedQty: "0",
      closingReading: "",
      thickness: "",
      notes: "",
    },
  });
  const quantities = useWatch({ control: form.control, name: ["goodQty", "rejectQty", "scrapQty", "consumedQty"] });
  const output = quantities.slice(0, 3).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const consumed = Number(quantities[3]) || 0;
  const reconciled = Math.abs(output - consumed) <= Math.max(consumed * 0.02, 0.5);
  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((values) =>
        post(`/api/v1/jobs/${jobId}/submit`, values, `/shop/jobs/${jobId}`),
      )}
    >
      {(["goodQty", "rejectQty", "scrapQty", "consumedQty"] as const).map(
        (name) => (
          <Field key={name} label={name.replace("Qty", " kg")} required>
            <input className={controlClass} inputMode="decimal" {...form.register(name)} />
          </Field>
        ),
      )}
      <p className={`rounded-[10px] px-3 py-2 text-sm ${reconciled ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
        Output {output.toFixed(3)} kg · Consumed {consumed.toFixed(3)} kg {reconciled ? "· balanced" : "· check quantities"}
      </p>
      <Field label="Closing counter">
        <input className={controlClass} {...form.register("closingReading")} />
      </Field>
      <Field label="Thickness">
        <input className={controlClass} {...form.register("thickness")} />
      </Field>
      <Field label="Notes">
        <textarea
          className={`${controlClass} h-24 py-2`}
          {...form.register("notes")}
        />
      </Field>
      <ErrorText error={error} />
      <Button pending={pending}>Submit job</Button>
    </form>
  );
}

export function ReasonForm({
  url,
  label,
  redirectTo,
}: {
  url: string;
  label: string;
  redirectTo?: string;
}) {
  const { post, error, pending } = usePost();
  const form = useForm({ defaultValues: { reason: "" } });
  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((values) => post(url, values, redirectTo))}
    >
      <Field label="Reason" required>
        <input className={controlClass} {...form.register("reason")} />
      </Field>
      <ErrorText error={error} />
      <Button pending={pending} tone="ghost">
        {label}
      </Button>
    </form>
  );
}

export function IdAction({
  url,
  label,
  redirectTo,
  confirmText,
}: {
  url: string;
  label: string;
  redirectTo?: string;
  confirmText?: string;
}) {
  const { post, error, pending } = usePost();
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirmText || window.confirm(confirmText))
            void post(url, {}, redirectTo);
        }}
        className="btn-primary disabled:opacity-60"
      >
        {pending ? "Saving…" : label}
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function MoveForm({
  batches,
  locations,
  mode,
}: {
  batches: { id: string; label: string }[];
  locations: { id: string; label: string }[];
  mode: "transfer" | "adjust";
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      batchId: batches[0]?.id ?? "",
      fromLocationId: locations[0]?.id ?? "",
      toLocationId: locations[1]?.id ?? locations[0]?.id ?? "",
      locationId: locations[0]?.id ?? "",
      qty: "",
      reason: "",
    },
  });
  const url =
    mode === "transfer"
      ? "/api/v1/inventory/transfers"
      : "/api/v1/inventory/adjustments";
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(
          url,
          mode === "transfer"
            ? values
            : {
                batchId: values.batchId,
                locationId: values.locationId,
                qty: values.qty,
                reason: values.reason,
              },
          "/inventory",
        ),
      )}
    >
      <Field label="Batch" required>
        <select className={controlClass} {...form.register("batchId")}>
          {batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      {mode === "transfer" ? (
        <>
          <Field label="From" required>
            <select
              className={controlClass}
              {...form.register("fromLocationId")}
            >
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To" required>
            <select className={controlClass} {...form.register("toLocationId")}>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <Field label="Location" required>
          <select className={controlClass} {...form.register("locationId")}>
            {locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Quantity" required>
        <input className={controlClass} inputMode="decimal" placeholder={mode === "adjust" ? "Use - to reduce stock" : "0.000"} {...form.register("qty")} />
      </Field>
      <Field label="Reason" required>
        <input className={controlClass} {...form.register("reason")} />
      </Field>
      <div className="md:col-span-2 space-y-3">
        <ErrorText error={error} />
        <Button pending={pending}>Save</Button>
      </div>
    </form>
  );
}

export function DispatchForm({
  customers,
  batches,
}: {
  customers: { id: string; name: string }[];
  batches: { id: string; label: string }[];
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      customerId: customers[0]?.id ?? "",
      batchId: batches[0]?.id ?? "",
      qty: "",
    },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/dispatch", values, "/dispatch"),
      )}
    >
      <Field label="Customer" required>
        <select className={controlClass} {...form.register("customerId")}>
          {customers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Finished batch" required>
        <select className={controlClass} {...form.register("batchId")}>
          {batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Qty kg" required>
        <input className={controlClass} inputMode="decimal" placeholder="0.000" {...form.register("qty")} />
      </Field>
      <div className="md:col-span-2 space-y-3">
        <ErrorText error={error} />
        <Button pending={pending}>Dispatch</Button>
      </div>
    </form>
  );
}

export function MaintenanceForm({
  machines,
}: {
  machines: { id: string; name: string }[];
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: { machineId: machines[0]?.id ?? "", issue: "" },
  });
  return (
    <form
      id="create-ticket"
      className="grid gap-3"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/maintenance", values, "/maintenance"),
      )}
    >
      <Field label="Machine" required>
        <select className={controlClass} {...form.register("machineId")}>
          {machines.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Issue" required>
        <input className={controlClass} {...form.register("issue")} />
      </Field>
      <ErrorText error={error} />
      <Button pending={pending}>Open ticket</Button>
    </form>
  );
}

export function EmployeeForm({
  shifts,
  canAssignAdmin = false,
}: {
  shifts: { id: string; name: string }[];
  canAssignAdmin?: boolean;
}) {
  const { post, error, pending } = usePost();
  const form = useForm({
    defaultValues: {
      name: "",
      code: "",
      designation: "",
      skill: "",
      shiftId: "",
      email: "",
      password: "",
      roleCode: "operator",
    },
  });
  const roleCode = useWatch({ control: form.control, name: "roleCode" });
  const permissionLabels = (ROLE_PERMISSIONS[roleCode] ?? []).map(
    (code) => PERMISSIONS.find((item) => item[0] === code)?.[1] ?? code,
  );
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/people/employees", values, "/people/employees"),
      )}
    >
      <Field label="Name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="Employee ID">
        <input
          className={controlClass}
          placeholder="Auto-generated if blank"
          {...form.register("code")}
        />
      </Field>
      <Field label="Role" required>
        <select className={controlClass} required {...form.register("roleCode")}>
          {roleChoices.filter((role) => role.code !== "admin" || canAssignAdmin).map((role) => (
            <option key={role.code} value={role.code}>
              {role.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Shift">
        <select className={controlClass} {...form.register("shiftId")}>
          <option value="">None</option>
          {shifts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Designation">
        <input className={controlClass} {...form.register("designation")} />
      </Field>
      <Field label="Machine skill">
        <input
          className={controlClass}
          placeholder="slitting"
          {...form.register("skill")}
        />
      </Field>
      <Field label="Login email">
        <input
          className={controlClass}
          placeholder="Optional. Blank uses the employee ID"
          {...form.register("email")}
        />
      </Field>
      <PasswordField
        label="Password"
        registration={form.register("password")}
        autoComplete="new-password"
        required
      />
      <div className="md:col-span-2 space-y-3">
        <p className="text-sm text-muted">
          Access from selected role: {permissionLabels.join(", ")}.
        </p>
        <ErrorText error={error} />
        <Button pending={pending}>Create employee</Button>
      </div>
    </form>
  );
}
