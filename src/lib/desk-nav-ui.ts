import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FileBarChart,
  FileText,
  UserPlus,
  Folder,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Package,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  User,
  Wrench,
  Cog,
  ArrowLeftRight,
  ScrollText,
  PackageSearch,
  History,
  Warehouse,
  Factory,
  Layers,
  ClipboardPlus,
  AlertTriangle,
} from "lucide-react";

export type DeskNavItem = { href: string; label: string; group: string };

export type SidebarBlock =
  | { type: "link"; href: string }
  | { type: "group"; id: string; label: string; hrefs: string[] };

export const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/users": User,
  "/employees": Contact,
  "/categories": Folder,
  "/products": Boxes,
  "/suppliers": Truck,
  "/machines": Cog,
  "/dies": LayoutGrid,
  "/leads": UserPlus,
  "/sales": FileText,
  "/purchase-orders": ShoppingCart,
  "/requisitions": FileBarChart,
  "/jobs": ClipboardList,
  "/job-approvals": ClipboardCheck,
  "/production": LineChart,
  "/dispatch": Truck,
  "/inventory": Package,
  "/inventory/register": Warehouse,
  "/inventory/factories": Factory,
  "/inventory/batches": Layers,
  "/inventory/ledger": ScrollText,
  "/inventory/qc": ShieldCheck,
  "/inventory/reservations": ClipboardPlus,
  "/inventory/transfer": ArrowLeftRight,
  "/inventory/adjust": SlidersHorizontal,
  "/inventory/alerts": AlertTriangle,
  "/inventory/reports": FileBarChart,
  "/material-requests": PackageSearch,
  "/quality": ShieldCheck,
  "/maintenance": Wrench,
  "/reports": FileBarChart,
  "/notifications": Bell,
  "/settings": SlidersHorizontal,
  "/shop": LayoutDashboard,
  "/shop/jobs": ClipboardList,
  "/shop/requests": PackageSearch,
  "/shop/history": History,
  "/shop/alerts": Bell,
  "/shop/qc": ShieldCheck,
};

/** Operator shop-floor sidebar (same chrome as desk). */
export const SHOP_SIDEBAR_BLOCKS: SidebarBlock[] = [
  { type: "link", href: "/shop" },
  { type: "link", href: "/shop/jobs" },
  { type: "link", href: "/shop/requests" },
  { type: "link", href: "/shop/history" },
  { type: "link", href: "/shop/alerts" },
];

export const SHOP_QC_SIDEBAR_BLOCKS: SidebarBlock[] = [
  { type: "link", href: "/shop/qc" },
  { type: "link", href: "/shop/alerts" },
];

export const SIDEBAR_GROUP_ICONS: Record<string, LucideIcon> = {
  jobs: ClipboardList,
  production: LineChart,
  inventory: Package,
  quality: ShieldCheck,
};

/** Flat sidebar order (no section headings). */
export const SIDEBAR_BLOCKS: SidebarBlock[] = [
  { type: "link", href: "/dashboard" },
  { type: "link", href: "/users" },
  { type: "link", href: "/employees" },
  { type: "link", href: "/products" },
  { type: "link", href: "/leads" },
  { type: "link", href: "/sales" },
  { type: "link", href: "/purchase-orders" },
  { type: "link", href: "/requisitions" },
  { type: "link", href: "/settings" },
  { type: "group", id: "jobs", label: "Jobs", hrefs: ["/jobs", "/job-approvals"] },
  {
    type: "group",
    id: "production",
    label: "Production",
    hrefs: ["/production", "/dispatch", "/material-requests"],
  },
  {
    type: "group",
    id: "inventory",
    label: "Inventory",
    hrefs: [
      "/inventory",
      "/inventory/register",
      "/inventory/factories",
      "/inventory/batches",
      "/inventory/ledger",
      "/inventory/qc",
      "/inventory/reservations",
      "/inventory/transfer",
      "/inventory/adjust",
      "/inventory/alerts",
      "/inventory/reports",
    ],
  },
  { type: "group", id: "quality", label: "Quality", hrefs: ["/quality", "/maintenance"] },
  { type: "link", href: "/reports" },
  { type: "link", href: "/notifications" },
];

export function itemByHref(items: DeskNavItem[], href: string) {
  return items.find((item) => item.href === href);
}
