import { z } from "zod";

const materialSpecKeySchema = z.enum(["grade", "thickness", "width", "length", "diameter", "weightPerPiece"]);

const qty = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, "Enter a quantity like 12.500");
const signedQty = z
  .string()
  .regex(/^-?\d+(\.\d{1,3})?$/, "Enter a numeric quantity");
const optionalQty = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/)
  .optional()
  .or(z.literal(""));

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
  uom: z.string().min(1, "Choose a unit"),
  rate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a rate"),
  taxPct: z.string().regex(/^\d+(\.\d{1,4})?$/, "Enter tax %").optional(),
  grade: z.string().optional(),
  thickness: optionalQty,
  width: optionalQty,
  length: optionalQty,
  diameter: optionalQty,
  finish: z.string().optional(),
});

export const purchaseOrderSchema = z.object({
  plantId: z.string().uuid(),
  supplierId: z.string().uuid(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  submit: z.coerce.boolean().optional(),
  lines: z.array(orderLineSchema).min(1, "Add at least one line"),
});

export const receiptLineSchema = z.object({
  orderItemId: z.string().uuid(),
  qty: qty.optional(),
  deliveredQty: qty.optional(),
  acceptedQty: qty.optional(),
  rejectedQty: qty.optional(),
  uom: z.string().optional(),
  heatNo: z.string().optional(),
  batchNo: z.string().max(64).optional(),
  actualWeight: optionalQty,
  grade: z.string().optional(),
  thickness: optionalQty,
  width: optionalQty,
  length: optionalQty,
  diameter: optionalQty,
  finish: z.string().optional(),
  inspectionStatus: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const receiptSchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().uuid(),
  notes: z.string().optional(),
  post: z.boolean().optional(),
  lines: z.array(receiptLineSchema).min(1),
});

export const cancelPoSchema = z.object({
  reason: z.string().min(3, "A cancellation reason is required"),
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

export const interFactoryCreateSchema = z.object({
  sourcePlantId: z.string().uuid(),
  destinationPlantId: z.string().uuid(),
  batchId: z.string().uuid(),
  sourceLocationId: z.string().uuid(),
  destLocationId: z.string().uuid(),
  requestedQty: qty,
  uom: z.string().min(1),
  notes: z.string().optional(),
});

export const interFactoryApproveSchema = z.object({
  transferId: z.string().uuid(),
  dispatchedQty: qty,
});

export const interFactoryReceiveSchema = z.object({
  transferId: z.string().uuid(),
  receivedQty: qty,
  rejectedQty: optionalQty,
  notes: z.string().optional(),
});

export const interFactoryCancelSchema = z.object({
  transferId: z.string().uuid(),
  reason: z.string().optional(),
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
  /** Required when assigning jobs tied to a sales order (desk assigns from SO detail only). */
  viaSalesOrder: z.literal(true).optional(),
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

export const jobMaterialAllocationsSchema = z.object({
  allocations: z.array(z.object({
    requestedMaterialId: z.string().uuid(),
    batchId: z.string().uuid(),
    locationId: z.string().uuid(),
    qty,
    uom: z.string().min(1),
    substitutionRequestId: z.string().uuid().optional(),
  })).min(1).optional(),
});

export const substitutionRequestSchema = z.object({
  requestedMaterialId: z.string().uuid(),
  batchId: z.string().uuid(),
  locationId: z.string().uuid(),
  requestedQty: qty,
  uom: z.string().min(1),
  reason: z.string().trim().min(8, "Explain why a substitute is needed."),
});

export const substitutionDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(3).optional(),
});

export const dispatchSchema = z.object({
  customerId: z.string().uuid(),
  batchId: z.string().uuid(),
  qty,
  salesOrderItemId: z.string().uuid().optional(),
});

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
  productForm: z.enum(["coil", "sheet", "circle", "blank", "wire", "rod", "pipe", "utensil", "component", "other"]).optional().or(z.literal("")),
  requiredSpecs: z.array(materialSpecKeySchema).max(6).optional(),
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
  parentId: z.string().uuid({ message: "Choose Trading Products or Manufactured Products as the parent." }),
  categoryType: z.enum(["raw_material", "wip", "finished_goods", "consumable", "scrap"]),
  productForm: z.enum(["coil", "sheet", "circle", "blank", "wire", "rod", "pipe", "utensil", "component", "other"]).optional().or(z.literal("")),
  requiredSpecs: z.array(materialSpecKeySchema).max(6).optional(),
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
    length: optionalQty,
    diameter: optionalQty,
    weightPerPiece: optionalQty,
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

export const createProductSchema = z
  .object({
    sku: z
      .string()
      .max(32)
      .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers, or hyphens")
      .optional()
      .or(z.literal("")),
    name: z.string().min(2),
    businessKind: z.enum(["trading", "manufactured"]),
    baseUnitSymbol: z.string().optional().or(z.literal("")),
    description: z.string().optional(),
    productType: z.string().optional(),
    specs: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((value, context) => {
    if (!value.baseUnitSymbol?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["baseUnitSymbol"],
        message: "Choose a unit.",
      });
    }
    for (const [key, raw] of Object.entries(value.specs ?? {})) {
      if (["thickness", "width", "length", "diameter", "netWeightKg", "innerDiameter", "outerDiameter", "height", "capacityLitres"].includes(key)) {
        if (raw.trim() && (!/^\d+(\.\d{1,3})?$/.test(raw) || Number(raw) <= 0)) {
          context.addIssue({ code: "custom", path: ["specs", key], message: "Enter a positive number." });
        }
      }
    }
  });

/** @deprecated Use createProductSchema — kept for older clients. */
export const catalogProductSchema = createProductSchema;

export const productDeleteSchema = z.object({});

export const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().max(120).optional(),
  grade: z.string().max(80).optional(),
  gradeId: z.string().uuid().optional(),
  finish: z.string().max(80).optional(),
  finishId: z.string().uuid().optional(),
  thickness: z.string().max(24).optional(),
  width: z.string().max(24).optional(),
  length: z.string().max(24).optional(),
  diameter: z.string().max(24).optional(),
  uom: z.string().max(12).optional(),
  attributes: z.record(z.string(), z.string().max(120)).optional(),
  isActive: z.boolean().optional(),
}).superRefine((variant, context) => {
  const dimensions: Record<string, string | undefined> = {
    thickness: variant.thickness, width: variant.width, length: variant.length, diameter: variant.diameter,
  };
  for (const [key, value] of Object.entries(dimensions)) {
    if (value?.trim() && (!/^\d+(\.\d{1,3})?$/.test(value) || Number(value) <= 0)) {
      context.addIssue({ code: "custom", path: [key], message: "Enter a positive number with up to three decimal places." });
    }
  }
  for (const key of Object.keys(variant.attributes ?? {})) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || ["productId", "productVariantId", "parentProductId", "categoryId"].includes(key)) {
      context.addIssue({ code: "custom", path: ["attributes", key], message: "Use a valid specification field name." });
    }
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

export const userCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleCode: userCreateRoleCodeSchema,
  customerId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  addressLine: z.string().max(500).optional().or(z.literal("")),
  ...userAccountEmployeeFields,
});

export const userUpdateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  roleCode: userCreateRoleCodeSchema,
  password: z.union([z.literal(""), z.string().min(8, "Password must be at least 8 characters")]).optional(),
  customerId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  addressLine: z.string().max(500).optional().or(z.literal("")),
  ...userAccountEmployeeFields,
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
    permissionCodes: z.array(z.string()).optional(),
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

const leadSourceSchema = z.enum(["WEBSITE", "VISIT", "PHONE", "REFERRAL", "OTHER"]);
const leadStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "QUOTATION_SENT",
  "CONVERTED",
  "ON_HOLD",
  "LOST",
  "REJECTED",
]);

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

export const leadItemSchema = z.object({
  categoryId: optionalUuid,
  productId: optionalUuid,
  parentProductId: optionalUuid,
  productVariantId: optionalUuid,
  itemDescription: z.string().max(500).optional(),
  quantity: qty,
  unitId: optionalUuid,
  uom: z.string().max(12).optional(),
  targetPrice: z.string().optional(),
  thickness: z.string().max(80).optional(),
  grade: z.string().max(80).optional(),
  size: z.string().max(80).optional(),
  estimatedWeight: z.string().optional().or(z.literal("")),
  specifications: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(500).optional(),
});

export const leadCreateSchema = z.object({
  queryDate: z.string().optional(),
  queryTime: z.string().optional(),
  contactPerson: z.string().min(2).max(120).optional(),
  contactDesignation: z.string().max(120).optional(),
  customerName: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8).max(20),
  address: z.string().max(500).optional(),
  companyName: z.string().max(120).optional(),
  customerId: optionalUuid,
  source: leadSourceSchema,
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigneeId: optionalUuid,
  nextFollowUpAt: z.string().optional(),
  notes: z.string().max(2000).optional(),
  requiredDeliveryDate: z.string().optional(),
  attendedById: optionalUuid,
  result: z.enum(["PENDING", "SUCCESS", "FAILURE"]).optional(),
  resultReason: z.string().max(200).optional(),
  officeRemarks: z.string().max(2000).optional(),
  items: z.array(leadItemSchema).min(1),
});

export const leadStatusChangeSchema = z.object({
  status: leadStatusSchema,
  reason: z.string().max(500).optional(),
});

export const leadAssignSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
});

export const leadVerifySchema = z.object({
  checks: z.object({
    customerConfirmed: z.literal(true),
    itemsConfirmed: z.literal(true),
    quantityConfirmed: z.literal(true),
    genuineRequirementConfirmed: z.literal(true),
  }),
  verificationNotes: z.string().max(2000).optional(),
});

export const leadActivitySchema = z.object({
  activityType: z.string().min(2).max(40),
  description: z.string().min(3).max(2000),
  nextFollowUpAt: z.string().optional(),
});

export const leadConvertSchema = z.object({
  lines: z
    .array(
      z.object({
        leadItemId: z.string().uuid(),
        productId: z.string().uuid().optional(),
        unitPrice: z.string().optional(),
      }),
    )
    .min(1),
});

export const publicLeadEnquirySchema = z.object({
  plantCode: z.string().max(32).optional(),
  customerName: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal("")),
  companyName: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  requiredDeliveryDate: z.string().date().optional(),
  commercialRemarks: z.string().max(1000).optional(),
  website: z.string().max(0).optional(),
  itemDescription: z.string().max(500).optional(),
  productId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  quantity: qty.optional(),
  uom: z.string().max(12).optional(),
  specifications: z.record(z.string(), z.unknown()).optional(),
  items: z.array(z.object({
    categoryId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    parentProductId: z.string().uuid().optional(),
    productVariantId: z.string().uuid().optional(),
    quantity: qty,
    uom: z.string().max(12).optional(),
    itemDescription: z.string().max(500).optional(),
    specifications: z.record(z.string(), z.string().max(120)).optional(),
    notes: z.string().max(500).optional(),
  })).min(1).max(10).optional(),
});

export const gradeMasterCreateSchema = z.object({
  name: z.string().trim().min(1, "Grade name is required").max(80),
  description: z.string().trim().max(500).optional(),
  productId: z.string().uuid().optional(),
  plantId: z.string().uuid().optional(),
});

export const gradeMasterUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
});

export const finishMasterCreateSchema = z.object({
  name: z.string().trim().min(1, "Finish name is required").max(80),
  description: z.string().trim().max(500).optional(),
  productId: z.string().uuid().optional(),
  plantId: z.string().uuid().optional(),
});

export const finishMasterUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
});

export const productCompatibilityToggleSchema = z.object({
  productId: z.string().uuid(),
  masterId: z.string().uuid(),
  type: z.enum(["grade", "finish"]),
  isActive: z.boolean(),
});

