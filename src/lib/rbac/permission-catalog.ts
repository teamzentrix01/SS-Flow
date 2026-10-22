/** Stable permission catalog for RBAC UI and idempotent seeding. */
export type PermissionDef = {
  code: string;
  name: string;
  module: string;
  description?: string;
};

export const PERMISSION_MODULES = [
  "Sales Orders",
  "Manufacturing",
  "Purchase Orders",
  "Inventory",
  "Suppliers",
  "Customers",
  "Employees",
  "Reports",
  "Administration",
  "General",
] as const;

export const PERMISSION_CATALOG: PermissionDef[] = [
  { code: "dashboard.view", name: "View dashboard", module: "General" },

  { code: "sales.view", name: "View sales orders", module: "Sales Orders" },
  { code: "sales.manage", name: "Create and edit sales orders", module: "Sales Orders" },
  { code: "sales.submit", name: "Submit sales orders", module: "Sales Orders" },
  { code: "sales.approve", name: "Approve sales orders", module: "Sales Orders" },
  { code: "sales.cancel", name: "Cancel sales orders", module: "Sales Orders" },

  { code: "production.view", name: "View production orders", module: "Manufacturing" },
  { code: "production.manage", name: "Plan and manage production", module: "Manufacturing" },
  { code: "job.assign", name: "Assign job cards", module: "Manufacturing" },
  { code: "job.execute", name: "Execute assigned jobs", module: "Manufacturing" },
  { code: "job.approve", name: "Approve job submissions", module: "Manufacturing" },
  { code: "qc.decide", name: "Quality inspection decisions", module: "Manufacturing" },

  { code: "purchase.view", name: "View purchase orders", module: "Purchase Orders" },
  { code: "purchase.manage", name: "Create and edit purchase orders", module: "Purchase Orders" },
  { code: "purchase.submit", name: "Submit purchase orders", module: "Purchase Orders" },
  { code: "purchase.approve", name: "Approve purchase orders", module: "Purchase Orders" },
  { code: "purchase.cancel", name: "Cancel purchase orders", module: "Purchase Orders" },

  { code: "inventory.view", name: "View stock and movements", module: "Inventory" },
  { code: "inventory.receive", name: "Receive materials", module: "Inventory" },
  { code: "inventory.issue", name: "Issue materials", module: "Inventory" },
  { code: "inventory.move", name: "Transfer and adjust stock", module: "Inventory" },
  { code: "material.request", name: "Raise material requests", module: "Inventory" },
  { code: "material.request.review", name: "Review material requests", module: "Inventory" },

  { code: "supplier.view", name: "View suppliers", module: "Suppliers" },
  { code: "supplier.manage", name: "Manage suppliers", module: "Suppliers" },

  { code: "customer.view", name: "View customers", module: "Customers" },
  { code: "customer.manage", name: "Manage customers", module: "Customers" },

  { code: "lead.view", name: "View leads and enquiries", module: "Sales Orders" },
  { code: "lead.manage", name: "Create and manage leads", module: "Sales Orders" },
  { code: "lead.verify", name: "Verify leads", module: "Sales Orders" },
  { code: "lead.convert", name: "Convert leads to sales orders", module: "Sales Orders" },

  { code: "employee.view", name: "View employees", module: "Employees" },
  { code: "employee.manage", name: "Manage employees", module: "Employees" },
  { code: "designation.manage", name: "Manage designations", module: "Employees" },
  { code: "department.manage", name: "Manage departments", module: "Employees" },

  { code: "report.view", name: "View reports", module: "Reports" },
  { code: "report.export", name: "Export reports", module: "Reports" },

  { code: "user.manage", name: "Manage users and login accounts", module: "Administration" },
  { code: "role.manage", name: "Manage roles and permissions", module: "Administration" },
  { code: "plant.manage", name: "Manage plant setup and settings", module: "Administration" },
  { code: "machine.manage", name: "Manage machines and dies", module: "Administration" },
  { code: "dispatch.manage", name: "Dispatch finished goods", module: "General" },
];

/** Legacy tuples for code that still imports PERMISSIONS from permissions.ts */
export const PERMISSIONS = PERMISSION_CATALOG.map((p) => [p.code, p.name] as const);

export const SYSTEM_ROLE_CODES = [
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
] as const;

/** Maps system role codes to permission codes (includes legacy + extended keys). */
export const ROLE_PERMISSION_MAP: Record<string, readonly string[]> = {
  admin: PERMISSION_CATALOG.map((p) => p.code),
  manager: [
    "dashboard.view",
    "sales.view",
    "sales.manage",
    "sales.approve",
    "purchase.view",
    "purchase.manage",
    "purchase.approve",
    "inventory.view",
    "inventory.move",
    "inventory.receive",
    "production.view",
    "production.manage",
    "job.assign",
    "job.approve",
    "employee.view",
    "employee.manage",
    "designation.manage",
    "report.view",
    "report.export",
    "user.manage",
    "role.manage",
    "designation.manage",
    "department.manage",
    "machine.manage",
    "plant.manage",
    "qc.decide",
    "dispatch.manage",
    "material.request.review",
    "supplier.view",
    "supplier.manage",
    "customer.view",
    "lead.view",
    "lead.manage",
    "lead.verify",
    "lead.convert",
  ],
  employee: [
    "dashboard.view",
    "job.execute",
    "material.request",
  ],
  customer: ["dashboard.view", "sales.view", "report.view", "customer.view"],
  supplier: ["dashboard.view", "inventory.view", "purchase.view", "purchase.manage", "report.view", "supplier.view"],
  sales: [
    "dashboard.view",
    "sales.view",
    "sales.manage",
    "sales.submit",
    "sales.approve",
    "sales.cancel",
    "report.view",
    "customer.view",
    "lead.view",
    "lead.manage",
    "lead.verify",
    "lead.convert",
  ],
  purchase: [
    "dashboard.view",
    "purchase.view",
    "purchase.manage",
    "purchase.submit",
    "purchase.approve",
    "inventory.view",
    "material.request.review",
    "report.view",
    "supplier.view",
  ],
  supervisor: [
    "dashboard.view",
    "inventory.view",
    "sales.view",
    "production.view",
    "production.manage",
    "job.assign",
    "job.approve",
    "employee.view",
    "report.view",
    "material.request.review",
    "machine.manage",
  ],
  operator: ["dashboard.view", "job.execute", "inventory.view", "material.request"],
  qc: ["dashboard.view", "inventory.view", "qc.decide", "report.view"],
};

export function permissionsByModule() {
  const map = new Map<string, PermissionDef[]>();
  for (const mod of PERMISSION_MODULES) map.set(mod, []);
  for (const perm of PERMISSION_CATALOG) {
    const list = map.get(perm.module) ?? [];
    list.push(perm);
    map.set(perm.module, list);
  }
  return map;
}
