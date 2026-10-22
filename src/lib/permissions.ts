import { PERMISSION_CATALOG, ROLE_PERMISSION_MAP } from "@/lib/rbac/permission-catalog";

export const PERMISSIONS = PERMISSION_CATALOG.map((p) => [p.code, p.name] as const);

/** @deprecated Use ROLE_PERMISSION_MAP from permission-catalog for seeding. */
export const LEGACY_PERMISSIONS = [
  ["dashboard.view", "View dashboard"],
  ["plant.manage", "Manage plant setup"],
  ["user.manage", "Manage login users and roles"],
  ["employee.manage", "Manage employees"],
  ["sales.view", "View sales orders"],
  ["sales.manage", "Create and edit sales orders"],
  ["sales.approve", "Approve sales orders"],
  ["purchase.manage", "Manage purchasing"],
  ["purchase.approve", "Approve purchase orders"],
  ["inventory.view", "View inventory"],
  ["inventory.move", "Transfer and adjust stock"],
  ["material.request", "Raise material shortage requests"],
  ["material.request.review", "Review material requests"],
  ["qc.decide", "Decide inspections"],
  ["production.manage", "Manage production"],
  ["job.assign", "Assign jobs"],
  ["job.execute", "Execute assigned jobs"],
  ["job.approve", "Approve jobs"],
  ["machine.manage", "Manage machines"],
  ["dispatch.manage", "Dispatch finished goods"],
  ["report.view", "View reports"],
] as const;

void LEGACY_PERMISSIONS;

/** Primary business roles requested for SteelFlow desk access. */
export const APP_USER_ROLE_CODES = ["admin", "manager", "employee", "customer", "supplier"] as const;
export type AppUserRoleCode = (typeof APP_USER_ROLE_CODES)[number];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  customer: "Customer",
  supplier: "Supplier",
  sales: "Sales",
  purchase: "Purchase",
  supervisor: "Supervisor",
  operator: "Operator",
  qc: "Quality",
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ...ROLE_PERMISSION_MAP,
  admin: [...ROLE_PERMISSION_MAP.admin],
};

/** Sidebar href allowlists per role (admin uses full permission filter). Legacy roles omit entries. */
export const ROLE_NAV_HREFS: Record<string, readonly string[] | "*"> = {
  admin: "*",
  manager: [
    "/dashboard",
    "/inventory",
    "/sales",
    "/leads",
    "/users",
    "/employees",
    "/products",
    "/purchase-orders",
    "/requisitions",
    "/receipts",
    "/material-requests",
    "/production",
    "/jobs",
    "/job-approvals",
    "/quality",
    "/maintenance",
    "/dispatch",
    "/reports",
    "/notifications",
    "/settings",
  ],
  employee: ["/shop", "/shop/jobs", "/shop/requests", "/shop/history", "/shop/alerts"],
  operator: ["/shop", "/shop/jobs", "/shop/requests", "/shop/history", "/shop/alerts"],
  customer: ["/dashboard", "/sales", "/notifications"],
  supplier: ["/dashboard", "/inventory", "/purchase-orders", "/requisitions", "/notifications"],
};

/** Same sequence as SIDEBAR_BLOCKS (used for search and mobile nav ordering). */
export const deskNav = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard.view", group: "Overview" },
  { href: "/users", label: "Users", permission: "user.manage", group: "Access" },
  { href: "/employees", label: "Employees", permission: "employee.manage", group: "Access" },
  { href: "/settings", label: "Settings", permission: "plant.manage", group: "Access" },
  { href: "/products", label: "Product catalog", permission: "plant.manage", group: "Masters" },
  { href: "/leads", label: "Leads", permission: "lead.view", group: "Sales & purchase" },
  { href: "/sales", label: "Sales orders", permission: "sales.view", group: "Sales & purchase" },
  { href: "/purchase-orders", label: "Purchase orders", permission: "purchase.manage", group: "Sales & purchase" },
  { href: "/requisitions", label: "Requisitions", permission: "purchase.manage", group: "Sales & purchase" },
  { href: "/inventory", label: "Inventory Overview", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/register", label: "Stock Register", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/factories", label: "Stock by Factory", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/batches", label: "Material Batches", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/ledger", label: "Stock Movements", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/qc", label: "QC & Inspection", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/reservations", label: "Stock Reservations", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/transfer", label: "Stock Transfers", permission: "inventory.move", group: "Inventory" },
  { href: "/inventory/adjust", label: "Stock Adjustments", permission: "inventory.move", group: "Inventory" },
  { href: "/inventory/alerts", label: "Reorder & Shortage Alerts", permission: "inventory.view", group: "Inventory" },
  { href: "/inventory/reports", label: "Inventory Reports", permission: "inventory.view", group: "Inventory" },
  { href: "/material-requests", label: "Material requests", permission: "material.request.review", group: "Inventory" },
  { href: "/jobs", label: "Job board", permission: "job.assign", group: "Operations" },
  { href: "/job-approvals", label: "Step approvals", permission: "job.approve", group: "Operations" },
  { href: "/production", label: "Production orders", permission: "production.manage", group: "Operations" },
  { href: "/dispatch", label: "Dispatch", permission: "dispatch.manage", group: "Dispatch" },
  { href: "/quality", label: "Inspections", permission: "qc.decide", group: "Quality" },
  { href: "/maintenance", label: "Breakdowns", permission: "machine.manage", group: "Maintenance" },
  { href: "/reports", label: "Reports", permission: "report.view", group: "Reports" },
  { href: "/notifications", label: "Notifications", permission: "dashboard.view", group: "Reports" },
  { href: "/shop", label: "Home", permission: "job.execute", group: "Shop floor" },
  { href: "/shop/jobs", label: "My jobs", permission: "job.execute", group: "Shop floor" },
  { href: "/shop/requests", label: "Material", permission: "material.request", group: "Shop floor" },
  { href: "/shop/history", label: "Activity", permission: "job.execute", group: "Shop floor" },
  { href: "/shop/alerts", label: "Alerts", permission: "job.execute", group: "Shop floor" },
  { href: "/shop/qc", label: "Inspection queue", permission: "qc.decide", group: "Shop floor" },
];

export function shopNavForSession(permissions: Set<string>, roles: Set<string>) {
  const shopItems = deskNav.filter(
    (item) =>
      item.group === "Shop floor" &&
      permissions.has(item.permission) &&
      (item.href !== "/shop/qc" || !permissions.has("job.execute")),
  );
  if (roles.has("admin")) return shopItems;

  const allowedRoots = new Set<string>();
  let hasPreset = false;
  for (const role of roles) {
    const preset = ROLE_NAV_HREFS[role];
    if (preset === "*") return shopItems;
    if (preset?.length) {
      hasPreset = true;
      for (const href of preset) allowedRoots.add(href);
    }
  }
  if (!hasPreset) return shopItems;
  return shopItems.filter((item) => hrefAllowed(item.href, [...allowedRoots]));
}

/** Desk login roles shown when creating a staff (employee) user account. */
export const STAFF_LOGIN_ROLE_CODES = [
  "manager",
  "employee",
  "supervisor",
  "operator",
  "sales",
  "purchase",
  "qc",
] as const;

export function roleCodesForSelect(includeLegacy = true) {
  const primary = APP_USER_ROLE_CODES.map((code) => ({ code, label: ROLE_LABELS[code] ?? code }));
  if (!includeLegacy) return primary;
  const legacy = (["sales", "purchase", "supervisor", "operator", "qc"] as const).map((code) => ({
    code,
    label: ROLE_LABELS[code] ?? code,
  }));
  return [...primary, ...legacy];
}

function hrefAllowed(href: string, allowedRoots: readonly string[]) {
  return allowedRoots.some((root) => href === root || href.startsWith(`${root}/`));
}

type DeskNavEntry = (typeof deskNav)[number];

function deskNavItem(entry: DeskNavEntry) {
  return { href: entry.href, label: entry.label, group: entry.group };
}

/** Desk sidebar entries (excludes shop-floor routes). */
function deskSidebarEntries() {
  return deskNav.filter((item) => item.group !== "Shop floor");
}

export function deskNavForSession(permissions: Set<string>, roles: Set<string>) {
  const deskOnly = deskSidebarEntries();

  if (roles.has("admin")) {
    return deskOnly.map(deskNavItem);
  }

  const allowedRoots = new Set<string>();
  let hasPreset = false;
  for (const role of roles) {
    const preset = ROLE_NAV_HREFS[role];
    if (preset === "*") {
      return deskOnly.map(deskNavItem);
    }
    if (preset?.length) {
      hasPreset = true;
      for (const href of preset) allowedRoots.add(href);
    }
  }

  if (hasPreset) {
    return deskOnly
      .filter((item) => hrefAllowed(item.href, [...allowedRoots]) && permissions.has(item.permission))
      .map(deskNavItem);
  }

  return deskNav.filter((item) => permissions.has(item.permission)).map(deskNavItem);
}
