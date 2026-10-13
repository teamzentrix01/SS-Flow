import { ROLE_LABELS } from "@/lib/permissions";

const ROLE_GREETING_ORDER = [
  "admin",
  "manager",
  "employee",
  "customer",
  "supplier",
  "supervisor",
  "sales",
  "purchase",
  "qc",
  "operator",
] as const;

export function deskGreetingLabel(roles: Set<string>, name: string) {
  for (const code of ROLE_GREETING_ORDER) {
    if (roles.has(code)) return ROLE_LABELS[code] ?? code;
  }
  const first = name.trim().split(/\s+/)[0];
  return first || name || "User";
}
