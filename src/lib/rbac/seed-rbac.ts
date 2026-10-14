import { prisma } from "@/db";
import { uuidv7 } from "@/lib/ids";
import { PERMISSION_CATALOG, ROLE_PERMISSION_MAP, SYSTEM_ROLE_CODES } from "@/lib/rbac/permission-catalog";
import { ROLE_LABELS } from "@/lib/permissions";

export async function seedRbacCatalog() {
  const permissionIds = new Map<string, string>();
  for (const perm of PERMISSION_CATALOG) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module, description: perm.description ?? null },
      create: {
        id: uuidv7(),
        code: perm.code,
        name: perm.name,
        module: perm.module,
        description: perm.description ?? null,
      },
    });
    permissionIds.set(perm.code, row.id);
  }

  for (const code of SYSTEM_ROLE_CODES) {
    const roleLabel = ROLE_LABELS[code] ?? code;
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: roleLabel, isSystem: true, isActive: true },
      create: {
        id: uuidv7(),
        code,
        name: roleLabel,
        description: `System role: ${roleLabel}`,
        isSystem: true,
        isActive: true,
      },
    });
    const codes = ROLE_PERMISSION_MAP[code] ?? [];
    for (const permissionCode of codes) {
      const permissionId = permissionIds.get(permissionCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
}

export async function seedDefaultDesignations(plantId: string) {
  const samples: { code: string; name: string; description: string }[] = [
    { code: "production-manager", name: "Production Manager", description: "Overall production planning and execution" },
    { code: "factory-manager", name: "Factory Manager", description: "Factory operations and workforce" },
    { code: "production-supervisor", name: "Production Supervisor", description: "Shop-floor supervision" },
    { code: "machine-operator", name: "Machine Operator", description: "Runs production machines" },
    { code: "purchase-manager", name: "Purchase Manager", description: "Procurement leadership" },
    { code: "purchase-executive", name: "Purchase Executive", description: "PO processing and supplier coordination" },
    { code: "sales-executive", name: "Sales Executive", description: "Customer orders and follow-up" },
    { code: "accountant", name: "Accountant", description: "Finance and costing support" },
    { code: "storekeeper", name: "Storekeeper", description: "Stores and inventory handling" },
    { code: "quality-inspector", name: "Quality Inspector", description: "Incoming and in-process QC" },
  ];
  for (const item of samples) {
    await prisma.designation.upsert({
      where: { plantId_code: { plantId, code: item.code } },
      update: { name: item.name, description: item.description, isActive: true },
      create: {
        id: uuidv7(),
        plantId,
        code: item.code,
        name: item.name,
        description: item.description,
        isActive: true,
      },
    });
  }
}
