import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FileBarChart,
  FileText,
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
  "/sales": FileText,
  "/purchase-orders": ShoppingCart,
  "/requisitions": FileBarChart,
  "/jobs": ClipboardList,
  "/job-approvals": ClipboardCheck,
  "/production": LineChart,
  "/dispatch": Truck,
  "/inventory": Package,
  "/inventory/ledger": ScrollText,
  "/inventory/transfer": ArrowLeftRight,
  "/inventory/adjust": SlidersHorizontal,
  "/material-requests": PackageSearch,
  "/quality": ShieldCheck,
  "/maintenance": Wrench,
  "/reports": FileBarChart,
  "/notifications": Bell,
  "/settings": SlidersHorizontal,
};

export const SIDEBAR_GROUP_ICONS: Record<string, LucideIcon> = {
  jobs: ClipboardList,
  production: LineChart,
  quality: ShieldCheck,
};

/** Flat sidebar order (no section headings). */
export const SIDEBAR_BLOCKS: SidebarBlock[] = [
  { type: "link", href: "/dashboard" },
  { type: "link", href: "/users" },
  { type: "link", href: "/employees" },
  { type: "link", href: "/products" },
  { type: "link", href: "/suppliers" },
  { type: "link", href: "/sales" },
  { type: "link", href: "/purchase-orders" },
  { type: "link", href: "/requisitions" },
  { type: "link", href: "/settings" },
  { type: "group", id: "jobs", label: "Jobs", hrefs: ["/jobs", "/job-approvals"] },
  {
    type: "group",
    id: "production",
    label: "Production",
    hrefs: [
      "/production",
      "/dispatch",
      "/inventory",
      "/inventory/ledger",
      "/inventory/transfer",
      "/inventory/adjust",
      "/material-requests",
    ],
  },
  { type: "group", id: "quality", label: "Quality", hrefs: ["/quality", "/maintenance"] },
  { type: "link", href: "/reports" },
  { type: "link", href: "/notifications" },
];

export function itemByHref(items: DeskNavItem[], href: string) {
  return items.find((item) => item.href === href);
}
