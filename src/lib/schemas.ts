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
  salesOrderItemId: z.string().uuid().optional(),
});

const optionalQty = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/)
  .optional()
  .or(z.literal(""));
const optionalRate = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .optional()
  .or(z.literal(""));
const optionalPct = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/)
  .optional()
  .or(z.literal(""));

export const categoryUpdateSchema = z.object({
  code: z
    .string()
    .min(2, "Category code is required")
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens"),
  name: z.string().min(2, "Category name is required"),
  parentId: z.string().uuid().optional().or(z.literal("")),
  categoryType: z.enum(["raw_material", "wip", "finished_goods", "consumable", "scrap"]),
  productForm: z.enum(["coil", "sheet", "utensil", "component", "other"]).optional().or(z.literal("")),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const categorySchema = z.object({
  code: z
    .string()
    .min(2, "Category code is required")
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens"),
  name: z.string().min(2, "Category name is required"),
  parentId: z.string().uuid().optional().or(z.literal("")),
  categoryType: z.enum(["raw_material", "wip", "finished_goods", "consumable", "scrap"]),
  productForm: z.enum(["coil", "sheet", "utensil", "component", "other"]).optional().or(z.literal("")),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const materialUpdateSchema = z
  .object({
    code: z.string().min(2),
    name: z.string().min(2),
    category: z.enum(["raw", "semi", "utensil", "consumable"]).optional(),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    productType: z.enum(["raw_material", "semi_finished", "finished", "consumable"]).optional(),
    shape: z.string().min(2),
    description: z.string().optional(),
    grade: z.string().optional(),
    thickness: optionalQty,
    width: optionalQty,
    uom: z.string().optional(),
    batchTracking: z.boolean().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .superRefine((value, context) => {
    if (!value.category && !value.productType) {
      context.addIssue({
        code: "custom",
        path: ["productType"],
        message: "Choose a product type.",
      });
    }
  });

export const materialSchema = z
  .object({
    code: z.string().optional(),
    name: z.string().min(2),
    category: z.enum(["raw", "semi", "utensil", "consumable"]).optional(),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    productType: z.enum(["raw_material", "semi_finished", "finished", "consumable"]).optional(),
    shape: z.string().min(2),
    description: z.string().optional(),
    brand: z.string().optional(),
    hsnCode: z.string().optional(),
    grade: z.string().optional(),
    thickness: optionalQty,
    width: optionalQty,
    length: optionalQty,
    diameter: optionalQty,
    weightPerPiece: optionalQty,
    standardScrapPct: optionalPct,
    uom: z.string().optional(),
    purchaseUom: z.string().optional(),
    salesUom: z.string().optional(),
    uomConversionFactor: optionalQty,
    minStockLevel: optionalQty,
    reorderLevel: optionalQty,
    batchTracking: z.boolean().optional(),
    serialTracking: z.boolean().optional(),
    defaultBomHeaderId: z.string().uuid().optional().or(z.literal("")),
    defaultRoutingId: z.string().uuid().optional().or(z.literal("")),
    purchaseAllowed: z.boolean().optional(),
    salesAllowed: z.boolean().optional(),
    manufacturingAllowed: z.boolean().optional(),
    defaultSupplierId: z.string().uuid().optional().or(z.literal("")),
    purchasePrice: optionalRate,
    sellingPrice: optionalRate,
    taxRate: optionalPct,
    status: z.enum(["active", "inactive"]).optional(),
  })
  .superRefine((value, context) => {
    if (!value.category && !value.productType) {
      context.addIssue({
        code: "custom",
        path: ["productType"],
        message: "Choose a product type.",
      });
    }
  });

export const bomSchema = z.object({
  scrapRate: z.string().optional(),
  items: z
    .array(
      z.object({
        materialId: z.string().uuid(),
        lineType: z.enum(["metal_sheet", "consumable", "subassembly"]).optional(),
        qtyPer: qty,
        lossPct: z.string().optional(),
        uom: z.string().optional(),
        dimLength: z.string().optional(),
        dimWidth: z.string().optional(),
        dimThickness: z.string().optional(),
      }),
    )
    .min(1),
});

const salesOrderNewCustomerSchema = z.object({
  name: z.string().min(2, "Customer name is required"),
  phone: z.string().optional(),
});

const salesOrderNewProductSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  code: z.string().optional(),
});

const salesOrderLineSchema = z
  .object({
    productId: z.string().uuid().optional(),
    newProduct: salesOrderNewProductSchema.optional(),
    qtyOrdered: qty,
    unitPrice: z.string().optional(),
    taxPct: z.string().optional(),
    discountPct: z.string().optional(),
  })
  .superRefine((line, context) => {
    const hasId = Boolean(line.productId);
    const hasNew = Boolean(line.newProduct);
    if (hasId === hasNew) {
      context.addIssue({
        code: "custom",
        message: "Select an existing product or provide details for a new product.",
        path: ["productId"],
      });
    }
  });

export const salesOrderSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    newCustomer: salesOrderNewCustomerSchema.optional(),
    promisedDate: z.string().optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    notes: z.string().optional(),
    productionNotes: z.string().optional(),
    lines: z.array(salesOrderLineSchema).min(1),
  })
  .superRefine((order, context) => {
    const hasCustomerId = Boolean(order.customerId);
    const hasNewCustomer = Boolean(order.newCustomer);
    if (hasCustomerId === hasNewCustomer) {
      context.addIssue({
        code: "custom",
        message: "Select an existing customer or provide details for a new customer.",
        path: ["customerId"],
      });
    }
  });

export const salesReasonSchema = z.object({
  reason: z.string().min(3),
});

export const materialRequestSchema = z.object({
  materialId: z.string().uuid(),
  qtyRequired: qty,
  reason: z.string().min(3),
  jobId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  requiredBy: z.string().optional(),
  notes: z.string().optional(),
});

export const materialRequestDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "fulfilled"]),
  remarks: z.string().optional(),
  qtyFulfilled: qty.optional(),
});

export const requisitionSchema = z.object({
  salesOrderId: z.string().uuid().optional(),
  notes: z.string().optional(),
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

export const userRoleCodeSchema = z.enum([
  "admin",
  "manager",
  "employee",
  "customer",
  "supplier",
  "sales",
  "purchase",
  "supervisor",
  "operator",
  "qc",
]);

export const userCreateRoleCodeSchema = z.enum(["employee", "customer", "supplier"]);

const userAccountEmployeeFields = {
  staffRoleCode: userRoleCodeSchema.optional(),
  employeeCode: z.string().regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers, or hyphens").optional().or(z.literal("")),
  designationId: z.string().uuid().optional().or(z.literal("")),
  newDesignation: z.string().max(120).optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  shiftId: z.string().uuid().optional().or(z.literal("")),
  plantIds: z.array(z.string().uuid()).optional(),
};

export const userCreateSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    roleCode: userCreateRoleCodeSchema,
    customerId: z.string().uuid().optional().or(z.literal("")),
    supplierId: z.string().uuid().optional().or(z.literal("")),
    ...userAccountEmployeeFields,
  })
  .superRefine((value, ctx) => {
    if (value.roleCode === "employee" && !value.staffRoleCode) {
      ctx.addIssue({ code: "custom", path: ["staffRoleCode"], message: "Choose a desk role for this employee." });
    }
  });

export const userUpdateSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    phone: z.string().optional(),
    roleCode: userCreateRoleCodeSchema,
    password: z.union([z.literal(""), z.string().min(8, "Password must be at least 8 characters")]).optional(),
    customerId: z.string().uuid().optional().or(z.literal("")),
    supplierId: z.string().uuid().optional().or(z.literal("")),
    ...userAccountEmployeeFields,
  })
  .superRefine((value, ctx) => {
    if (value.roleCode === "employee" && !value.staffRoleCode) {
      ctx.addIssue({ code: "custom", path: ["staffRoleCode"], message: "Choose a desk role for this employee." });
    }
  });

const employeeBaseSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers, or hyphens").optional().default(""),
  phone: z.string().optional(),
  designation: z.string().optional(),
  designationId: z.string().uuid().optional().or(z.literal("")),
  plantIds: z.array(z.string().uuid()).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  skill: z.string().optional(),
  additionalSkills: z.array(z.string()).optional(),
  skillLevel: z.enum(["trainee", "skilled", "expert"]).optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  shiftId: z.string().uuid().optional().or(z.literal("")),
  supervisorId: z.string().uuid().optional().or(z.literal("")),
  assignedMachineId: z.string().uuid().optional().or(z.literal("")),
  joiningDate: z.string().optional(),
  employmentType: z.enum(["permanent", "contract", "trainee"]).optional().or(z.literal("")),
  employmentStatus: z.enum(["active", "inactive", "on_leave"]).optional(),
  loginEnabled: z.boolean().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  roleCode: userRoleCodeSchema.optional(),
});

function refineEmployeeLogin<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, context) => {
    const row = value as z.infer<typeof employeeBaseSchema>;
    if (row.loginEnabled !== false) {
      if (!row.password || row.password.length < 8) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password must be at least 8 characters when login is enabled.",
        });
      }
      const hasRoles = row.roleIds && row.roleIds.length > 0;
      if (!hasRoles && !row.roleCode) {
        context.addIssue({
          code: "custom",
          path: ["roleCode"],
          message: "Choose at least one system role when login is enabled.",
        });
      }
    }
  });
}

export const employeeSchema = refineEmployeeLogin(employeeBaseSchema);

export const updateEmployeeSchema = employeeBaseSchema
  .extend({
    code: z.string().min(2, "Employee ID is required").regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens"),
    roleCode: userRoleCodeSchema.optional(),
    roleIds: z.array(z.string().uuid()).optional(),
    password: z.union([z.literal(""), z.string().min(8, "Password must be at least 8 characters")]).optional(),
  })
  .superRefine((value, context) => {
    if (value.password && value.password.length > 0 && value.password.length < 8) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Password must be at least 8 characters.",
      });
    }
  });

export const designationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().max(64).optional(),
  description: z.string().max(500).optional(),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  plantId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const roleSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().max(48).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  permissionCodes: z.array(z.string()).default([]),
});

export const userRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});
