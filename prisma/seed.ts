import { prisma } from "../src/db";
import { hashPassword } from "../src/lib/auth/password";
import { uuidv7 } from "../src/lib/ids";
import { ROLE_LABELS } from "../src/lib/permissions";
import { seedDefaultDesignations, seedRbacCatalog } from "../src/lib/rbac/seed-rbac";
import { seedDemoRawMaterialStock } from "../src/modules/inventory/seed-demo-stock";
import {
  linkLegacyMaterialsToCatalog,
  seedProductCatalog,
} from "../src/modules/masters/seed-product-catalog";

function requiredEnv(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "DEMO_USER_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for seeding.`);
  return value;
}

const adminEmail = requiredEnv("ADMIN_EMAIL").trim().toLowerCase();
const adminPassword = requiredEnv("ADMIN_PASSWORD");
const demoPassword = requiredEnv("DEMO_USER_PASSWORD");

async function main() {
  await seedRbacCatalog();

  const plant = await prisma.plant.upsert({
    where: { code: "PLANT-01" },
    update: {},
    create: { id: uuidv7(), code: "PLANT-01", name: "SS Steel Plant", isDemo: true },
  });
  const plant2 = await prisma.plant.upsert({
    where: { code: "PLANT-02" },
    update: {},
    create: { id: uuidv7(), code: "PLANT-02", name: "SS Metals Factory 2", isDemo: true },
  });
  await seedDefaultDesignations(plant.id);
  await seedDefaultDesignations(plant2.id);
  await seedProductCatalog(plant.id);
  await seedProductCatalog(plant2.id);
  const department = await prisma.department.upsert({
    where: { plantId_name: { plantId: plant.id, name: "Slitting" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, name: "Slitting" },
  });
  const shift = await prisma.shift.upsert({
    where: { plantId_name: { plantId: plant.id, name: "Morning" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, name: "Morning", startTime: "09:00", endTime: "17:00" },
  });
  const warehouse = await prisma.warehouse.upsert({
    where: { plantId_code: { plantId: plant.id, code: "WH-01" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, code: "WH-01", name: "Main bay" },
  });
  await prisma.storageLocation.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "A-01" } },
    update: {},
    create: { id: uuidv7(), warehouseId: warehouse.id, code: "A-01", name: "Coil rack A" },
  });

  async function upsertCategory(input: {
    code: string;
    name: string;
    categoryType: string;
    productForm?: string;
    parentCode?: string;
    description?: string;
  }) {
    const parent = input.parentCode
      ? await prisma.productCategory.findFirst({ where: { plantId: plant.id, code: input.parentCode } })
      : null;
    await prisma.productCategory.upsert({
      where: { plantId_code: { plantId: plant.id, code: input.code } },
      update: { name: input.name, categoryType: input.categoryType, productForm: input.productForm ?? null },
      create: {
        id: uuidv7(),
        plantId: plant.id,
        code: input.code,
        name: input.name,
        parentId: parent?.id ?? null,
        categoryType: input.categoryType,
        productForm: input.productForm ?? null,
        description: input.description ?? null,
        status: "active",
      },
    });
  }

  await upsertCategory({ code: "RM", name: "Raw Materials", categoryType: "raw_material" });
  await upsertCategory({ code: "RM-COIL", name: "Stainless Steel Coil", categoryType: "raw_material", productForm: "coil", parentCode: "RM" });
  await upsertCategory({ code: "RM-SHEET", name: "Aluminium Sheet", categoryType: "raw_material", productForm: "sheet", parentCode: "RM" });
  await upsertCategory({ code: "SFG", name: "Semi-Finished Goods", categoryType: "wip" });
  await upsertCategory({ code: "SFG-BLANK", name: "Cut Blanks", categoryType: "wip", productForm: "component", parentCode: "SFG" });
  await upsertCategory({ code: "SFG-STRIP", name: "Slit Strips", categoryType: "wip", productForm: "component", parentCode: "SFG" });
  await upsertCategory({ code: "FG", name: "Finished Goods", categoryType: "finished_goods" });
  await upsertCategory({ code: "UTN", name: "Utensils", categoryType: "finished_goods", productForm: "utensil", parentCode: "FG", description: "Stainless steel utensils" });
  await upsertCategory({ code: "CON", name: "Consumables", categoryType: "consumable" });
  await upsertCategory({ code: "CON-WELD", name: "Welding Rods", categoryType: "consumable", parentCode: "CON" });
  await upsertCategory({ code: "SCRAP", name: "Scrap & Waste", categoryType: "scrap" });
  const catUtensils = await prisma.productCategory.findFirst({ where: { plantId: plant.id, code: "UTN" } });
  const catSheet = await prisma.productCategory.findFirst({ where: { plantId: plant.id, code: "RM-SHEET" } });
  await prisma.materialMaster.upsert({
    where: { plantId_code: { plantId: plant.id, code: "RM-COIL" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, code: "RM-COIL", name: "HR coil", category: "raw", shape: "coil", grade: "IS2062", thickness: "2.000", width: "1250", isDemo: true },
  });
  await prisma.materialMaster.upsert({
    where: { plantId_code: { plantId: plant.id, code: "FG-SLIT" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, code: "FG-SLIT", name: "Slit coil", category: "semi", shape: "slit_coil", grade: "IS2062", thickness: "2.000", isDemo: true },
  });
  await prisma.materialMaster.upsert({
    where: { plantId_code: { plantId: plant.id, code: "RM-SHEET-SS304" } },
    update: { categoryId: catSheet?.id, productType: "raw_material" },
    create: {
      id: uuidv7(),
      plantId: plant.id,
      code: "RM-SHEET-SS304",
      name: "SS304 sheet",
      category: "raw",
      categoryId: catSheet?.id ?? null,
      productType: "raw_material",
      shape: "sheet",
      grade: "SS304",
      thickness: "1.000",
      width: "1000",
      uom: "KG",
      isDemo: true,
    },
  });
  await prisma.materialMaster.upsert({
    where: { plantId_code: { plantId: plant.id, code: "FG-SPOON" } },
    update: { categoryId: catUtensils?.id, productType: "finished" },
    create: {
      id: uuidv7(),
      plantId: plant.id,
      code: "FG-SPOON",
      name: "Stainless spoon",
      category: "utensil",
      categoryId: catUtensils?.id ?? null,
      productType: "finished",
      shape: "spoon",
      grade: "SS304",
      uom: "PCS",
      specs: { design: "classic", materialGrade: "SS304" },
      isDemo: true,
    },
  });
  const rawSheet = await prisma.materialMaster.findUniqueOrThrow({ where: { plantId_code: { plantId: plant.id, code: "RM-SHEET-SS304" } } });
  const spoon = await prisma.materialMaster.findUniqueOrThrow({ where: { plantId_code: { plantId: plant.id, code: "FG-SPOON" } } });
  const existingBom = await prisma.bomHeader.findFirst({ where: { plantId: plant.id, productId: spoon.id, active: true } });
  if (!existingBom) {
    await prisma.bomHeader.create({
      data: {
        id: uuidv7(),
        plantId: plant.id,
        productId: spoon.id,
        version: 1,
        scrapRate: "0.05",
        items: {
          create: [{ id: uuidv7(), materialId: rawSheet.id, lineType: "metal_sheet", qtyPer: "0.05", uom: "KG" }],
        },
      },
    });
  }
  const utensilRouting = await prisma.routingHeader.findFirst({ where: { plantId: plant.id, productId: spoon.id } });
  if (!utensilRouting) {
    await prisma.routingHeader.create({
      data: {
        id: uuidv7(),
        plantId: plant.id,
        productId: spoon.id,
        name: "Spoon line",
        operations: {
          create: [
            { id: uuidv7(), sequence: 1, name: "Cutting", machineType: "cutting" },
            { id: uuidv7(), sequence: 2, name: "Forming", machineType: "pressing" },
            { id: uuidv7(), sequence: 3, name: "Polishing", machineType: "finishing" },
            { id: uuidv7(), sequence: 4, name: "Quality inspection", machineType: "qc" },
          ],
        },
      },
    });
  }
  const product = await prisma.materialMaster.findUniqueOrThrow({ where: { plantId_code: { plantId: plant.id, code: "FG-SLIT" } } });
  const routing = await prisma.routingHeader.findFirst({ where: { plantId: plant.id, productId: product.id } });
  if (!routing) {
    await prisma.routingHeader.create({
      data: {
        id: uuidv7(), plantId: plant.id, productId: product.id, name: "Coil to slit",
        operations: { create: [{ id: uuidv7(), sequence: 1, name: "Slitting", machineType: "slitting" }, { id: uuidv7(), sequence: 2, name: "Finish check", machineType: "slitting" }] },
      },
    });
  }
  await prisma.supplier.upsert({
    where: { plantId_code: { plantId: plant.id, code: "SUP-DEMO" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, code: "SUP-DEMO", name: "Demo Coil Supplier", phone: "0000000000", isDemo: true },
  });
  await prisma.customer.upsert({
    where: { plantId_code: { plantId: plant.id, code: "CUS-DEMO" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, code: "CUS-DEMO", name: "Demo Customer", isDemo: true },
  });
  await prisma.machine.upsert({
    where: { plantId_code: { plantId: plant.id, code: "SL-01" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, departmentId: department.id, code: "SL-01", name: "Slitter 1", machineType: "slitting", readingRequired: true, isDemo: true },
  });
  await prisma.die.upsert({
    where: { plantId_code: { plantId: plant.id, code: "DIE-01" } },
    update: {},
    create: { id: uuidv7(), plantId: plant.id, code: "DIE-01", name: "1250 slit die", dieType: "slit", isDemo: true },
  });

  const people: ReadonlyArray<readonly [string, string, "admin" | "sales" | "purchase" | "supervisor" | "operator" | "qc", string, string]> = [
    [adminEmail, "Plant Admin", "admin", "EMP-ADMIN", "all"],
    ["sales@ssflow.local", "Sales Desk", "sales", "EMP-SAL", "all"],
    ["purchase@ssflow.local", "Purchase Desk", "purchase", "EMP-PUR", "purchase"],
    ["supervisor@ssflow.local", "Shift Supervisor", "supervisor", "EMP-SUP", "all"],
    ["operator@ssflow.local", "Machine Operator", "operator", "EMP-OPR", "slitting"],
    ["qc@ssflow.local", "Quality Inspector", "qc", "EMP-QC", "quality"],
  ] as const;
  for (const [email, name, roleCode, employeeCode, skill] of people) {
    const passwordHash = await hashPassword(roleCode === "admin" ? adminPassword : demoPassword);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, ...(roleCode === "admin" ? { passwordHash } : {}) },
      create: { id: uuidv7(), email, name, passwordHash, isDemo: true },
    });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
    await prisma.userPlantAccess.upsert({ where: { userId_plantId: { userId: user.id, plantId: plant.id } }, update: {}, create: { userId: user.id, plantId: plant.id } });
    await prisma.employee.upsert({
      where: { plantId_code: { plantId: plant.id, code: employeeCode } },
      update: { userId: user.id },
      create: { id: uuidv7(), plantId: plant.id, userId: user.id, code: employeeCode, name, skill, shiftId: shift.id, departmentId: department.id, isDemo: true },
    });
  }
  const demoCustomer = await prisma.customer.findFirst({ where: { plantId: plant.id, code: "CUS-DEMO" } });
  const demoSupplier = await prisma.supplier.findFirst({ where: { plantId: plant.id, code: "SUP-DEMO" } });
  const portalUsers: ReadonlyArray<
    readonly [string, string, "manager" | "employee" | "customer" | "supplier", string?, string?]
  > = [
    ["manager@ssflow.local", "Plant Manager", "manager", "+910000000001"],
    ["employee@ssflow.local", "Shop Employee", "employee", "+910000000002"],
    ...(demoCustomer
      ? ([["customer@ssflow.local", "Demo Customer Login", "customer", "+910000000003", demoCustomer.id]] as const)
      : []),
    ...(demoSupplier
      ? ([["supplier@ssflow.local", "Demo Supplier Login", "supplier", "+910000000004", demoSupplier.id]] as const)
      : []),
  ];
  for (const entry of portalUsers) {
    const [email, name, roleCode, phone, linkId] = entry;
    const passwordHash = await hashPassword(demoPassword);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, phone: phone ?? null },
      create: {
        id: uuidv7(),
        email,
        name,
        phone: phone ?? null,
        passwordHash,
        isDemo: true,
        customerId: roleCode === "customer" ? (linkId as string) : null,
        supplierId: roleCode === "supplier" ? (linkId as string) : null,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    await prisma.userPlantAccess.upsert({
      where: { userId_plantId: { userId: user.id, plantId: plant.id } },
      update: {},
      create: { userId: user.id, plantId: plant.id },
    });
  }

  await linkLegacyMaterialsToCatalog(plant.id);
  await linkLegacyMaterialsToCatalog(plant2.id);

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  await seedDemoRawMaterialStock(plant.id, adminUser.id);
  await seedDemoRawMaterialStock(plant2.id, adminUser.id);

  console.log("Seeded SS Steel Plant and configured the admin account from environment variables.");
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
