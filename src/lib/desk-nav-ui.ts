import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Boxes,
  ClipboardList,
  Factory,
  FileBarChart,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  Cog,
  Layers,
  ArrowLeftRight,
  SlidersHorizontal,
  ScrollText,
  PackageSearch,
} from "lucide-react";

export type DeskNavItem = { href: string; label: string; group: string };

export const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/jobs": ClipboardList,
  "/production": Factory,
  "/machines": Cog,
  "/dies": Layers,
  "/dispatch": Truck,
  "/inventory": Package,
  "/inventory/ledger": ScrollText,
  "/inventory/transfer": ArrowLeftRight,
  "/inventory/adjust": SlidersHorizontal,
  "/material-requests": PackageSearch,
  "/sales": ShoppingCart,
  "/masters/products": Boxes,
  "/purchasing/suppliers": Users,
  "/purchasing/orders": ShoppingCart,
  "/purchasing/requisitions": FileBarChart,
  "/quality": ShieldCheck,
  "/people/employees": Users,
  "/maintenance": Wrench,
  "/reports": FileBarChart,
  "/notifications": Bell,
  "/settings": Settings,
};

/** Visual sections for the desk sidebar (all deskNav hrefs are assigned). */
export const SIDEBAR_SECTIONS: {
  label: string;
  blocks: (
    | { type: "link"; href: string }
    | { type: "group"; id: string; label: string; hrefs: string[] }
  )[];
}[] = [
  {
    label: "OVERVIEW",
    blocks: [{ type: "link", href: "/dashboard" }],
  },
  {
    label: "OPERATIONS",
    blocks: [
      { type: "link", href: "/jobs" },
      { type: "link", href: "/production" },
      { type: "link", href: "/machines" },
      { type: "link", href: "/dies" },
      { type: "link", href: "/dispatch" },
    ],
  },
  {
    label: "SUPPLY",
    blocks: [
      {
        type: "group",
        id: "inventory",
        label: "Inventory",
        hrefs: ["/inventory", "/inventory/ledger", "/inventory/transfer", "/inventory/adjust", "/material-requests"],
      },
      {
        type: "group",
        id: "purchasing",
        label: "Purchasing",
        hrefs: ["/purchasing/suppliers", "/purchasing/orders", "/purchasing/requisitions"],
      },
      { type: "link", href: "/sales" },
      { type: "link", href: "/masters/products" },
    ],
  },
  {
    label: "QUALITY & PEOPLE",
    blocks: [
      { type: "link", href: "/quality" },
      { type: "link", href: "/people/employees" },
      { type: "link", href: "/maintenance" },
    ],
  },
  {
    label: "ADMIN",
    blocks: [
      { type: "link", href: "/reports" },
      { type: "link", href: "/notifications" },
      { type: "link", href: "/settings" },
    ],
  },
];

export function itemByHref(items: DeskNavItem[], href: string) {
  return items.find((item) => item.href === href);
}
