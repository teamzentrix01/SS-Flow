import { prisma } from "../src/db";
import { hashPassword } from "../src/lib/auth/password";
import { uuidv7 } from "../src/lib/ids";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/permissions";

const password = "SteelFlow#2026";

async function main() {
  const passwordHash = await hashPassword(password);
  const permissionIds = new Map<string, string>();
  for (const [code, name] of PERMISSIONS) {
    const row = await prisma.permission.upsert({ where: { code }, update: { name }, create: { id: uuidv7(), code, name } });
    permissionIds.set(code, row.id);
  }
  for (const [code, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: code },
      create: { id: uuidv7(), code, name: code[0]!.toUpperCase() + code.slice(1) },
    });
    for (const permission of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionIds.get(permission)! } },
        update: {},
        create: { roleId: role.id, permissionId: permissionIds.get(permission)! },
      });
    }
  }

  const plant = await prisma.plant.upsert({
    where: { code: "PLANT-01" },
    update: {},
    create: { id: uuidv7(), code: "PLANT-01", name: "SS Steel Plant", isDemo: true },
  });
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

  const people = [
    ["admin@ssflow.local", "Plant Admin", "admin", "EMP-ADMIN", "all"],
    ["purchase@ssflow.local", "Purchase Desk", "purchase", "EMP-PUR", "purchase"],
    ["supervisor@ssflow.local", "Shift Supervisor", "supervisor", "EMP-SUP", "all"],
    ["operator@ssflow.local", "Machine Operator", "operator", "EMP-OPR", "slitting"],
    ["qc@ssflow.local", "Quality Inspector", "qc", "EMP-QC", "quality"],
  ] as const;
  for (const [email, name, roleCode, employeeCode, skill] of people) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
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
  console.log("Seeded SS Steel Plant. Password for demo users:", password);
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
