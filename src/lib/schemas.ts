import { z } from "zod";

const qty = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, "Enter a quantity like 12.500");
const signedQty = z
  .string()
  .regex(/^-?\d+(\.\d{1,3})?$/, "Enter a numeric quantity");

export const loginSchema = z.object({
  email: z.string().min(2, "Email or employee ID is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const supplierSchema = z.object({
  name: z.string().min(2),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const orderLineSchema = z.object({
  materialId: z.string().uuid(),
  qty,
  rate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a rate"),
  grade: z.string().optional(),
  thickness: z.string().optional(),
  width: z.string().optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(orderLineSchema).min(1, "Add at least one line"),
});

export const receiptSchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().uuid(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        qty,
        heatNo: z.string().optional(),
        batchNo: z.string().min(2),
        grade: z.string().optional(),
        thickness: z.string().optional(),
        width: z.string().optional(),
      }),
    )
    .min(1),
});

export const decisionSchema = z
  .object({
    decision: z.enum(["pass", "hold", "fail", "rework"]),
    remarks: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.decision !== "pass" &&
      (!value.remarks || value.remarks.trim().length < 3)
    ) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Add a reason for hold, fail, or rework.",
      });
    }
  });

export const transferSchema = z.object({
  batchId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  qty,
  reason: z.string().min(3, "A reason is required"),
});

export const adjustSchema = z.object({
  batchId: z.string().uuid(),
  locationId: z.string().uuid(),
  qty: signedQty,
  reason: z.string().min(3, "A reason is required"),
});

export const productionSchema = z.object({
  productId: z.string().uuid(),
  sourceBatchId: z.string().uuid(),
  locationId: z.string().uuid(),
  inputQty: qty,
  targetQty: qty,
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export const createJobSchema = z.object({
  name: z.string().min(2, "Job name is required"),
  productId: z.string().uuid(),
  sourceBatchId: z.string().uuid().optional().or(z.literal("")),
  inputQty: z.string().optional(),
  targetQty: qty,
});

export const assignSchema = z.object({
  employeeId: z.string().uuid(),
  machineId: z.string().uuid(),
  dieId: z.string().uuid().optional().or(z.literal("")),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export const startSchema = z.object({
  openingReading: z.string().optional(),
  confirmed: z.literal(true),
});

export const pauseSchema = z.object({
  reason: z.string().min(3, "Pause needs a reason"),
});

export const progressSchema = z.object({
  goodQty: qty,
  rejectQty: qty,
  scrapQty: qty,
  notes: z.string().optional(),
});

export const submitSchema = z.object({
  goodQty: qty,
  rejectQty: qty,
  scrapQty: qty,
  consumedQty: qty,
  closingReading: z.string().optional(),
  thickness: z.string().optional(),
  notes: z.string().optional(),
});

export const correctionSchema = z.object({
  reason: z.string().min(3, "A correction reason is required"),
});

export const dispatchSchema = z.object({
  customerId: z.string().uuid(),
  batchId: z.string().uuid(),
  qty,
});

export const maintenanceSchema = z.object({
  machineId: z.string().uuid(),
  issue: z.string().min(3),
});

export const machineSchema = z.object({
  code: z
    .string()
    .min(2, "Machine code is required")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens"),
  name: z.string().min(2, "Machine name is required"),
  machineType: z.string().min(2, "Machine type is required"),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  readingRequired: z.boolean().optional(),
});

export const dieSchema = z.object({
  code: z
    .string()
    .min(2, "Die code is required")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens"),
  name: z.string().min(2, "Die name is required"),
  dieType: z.string().min(2, "Die type is required"),
  lifeLimit: z
    .string()
    .regex(/^\d+$/, "Life limit must be a whole number")
    .optional()
    .or(z.literal("")),
});

export const customerSchema = z.object({
  name: z.string().min(2, "Customer name is required"),
  phone: z.string().optional(),
});

export const employeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers, or hyphens").optional().default(""),
  designation: z.string().optional(),
  skill: z.string().optional(),
  shiftId: z.string().uuid().optional().or(z.literal("")),
  email: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleCode: z.enum(["admin", "purchase", "supervisor", "operator", "qc"]),
});

export const updateEmployeeSchema = employeeSchema.extend({
  code: z.string().min(2, "Employee ID is required").regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens"),
  password: z.union([z.literal(""), z.string().min(8, "Password must be at least 8 characters")]).optional(),
});
