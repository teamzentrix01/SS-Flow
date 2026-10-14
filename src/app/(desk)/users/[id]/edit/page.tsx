import { DeskFormPage } from "@/components/desk";
import { UserEditForm } from "@/components/user-edit-form";
import { requirePage } from "@/lib/access";
import {
  getDeskUser,
  listCustomers,
  listDepartments,
  listShifts,
  listSuppliers,
  plantSetup,
} from "@/lib/queries";
import { STAFF_LOGIN_ROLE_CODES } from "@/lib/permissions";
import { listActiveDesignations } from "@/modules/rbac/designations";
import { notFound } from "next/navigation";

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("user.manage");
  const { id } = await params;
  const [user, departments, designations, shifts, setup, customers, suppliers] = await Promise.all([
    getDeskUser(id, session.plantIds),
    listDepartments(session.plantIds),
    listActiveDesignations(session.plantIds),
    listShifts(session.plantIds),
    plantSetup(session.plantIds),
    listCustomers(session.plantIds),
    listSuppliers(session.plantIds),
  ]);
  if (!user) notFound();

  const roleCodes = user.userRoles.map((link) => link.role.code);
  const staffRole =
    roleCodes.find((code) => (STAFF_LOGIN_ROLE_CODES as readonly string[]).includes(code)) ?? "operator";
  let accountType: "employee" | "customer" | "supplier" = "employee";
  if (user.customerId) accountType = "customer";
  else if (user.supplierId) accountType = "supplier";
  else if (user.employee || staffRole) accountType = "employee";

  const plantIds = user.plantAccess.map((row) => row.plantId);
  const emp = user.employee;

  return (
    <DeskFormPage title="Edit user" backHref={`/users/${id}`} backLabel="Back to user">
      <UserEditForm
        userId={id}
        email={user.email}
        initialPlantIds={plantIds.length ? plantIds : session.plantIds.slice(0, 1)}
        defaultValues={{
          name: user.name,
          phone: user.phone ?? "",
          roleCode: accountType,
          staffRoleCode: staffRole,
          employeeCode: emp?.code ?? "",
          designationId: emp?.designationId ?? "",
          newDesignation: "",
          departmentId: emp?.departmentId ?? "",
          shiftId: emp?.shiftId ?? "",
          customerId: user.customerId ?? "",
          supplierId: user.supplierId ?? "",
          password: "",
        }}
        options={{
          departments: departments.map((d) => ({ id: d.id, name: d.name })),
          designations,
          shifts: shifts.map((s) => ({ id: s.id, name: s.name })),
          plants: setup.plants.map((p) => ({ id: p.id, name: p.name, code: p.code })),
          customers: customers.map((c) => ({ id: c.id, name: c.name, code: c.code })),
          suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code })),
          defaultPlantIds: session.plantIds.slice(0, 1),
        }}
      />
    </DeskFormPage>
  );
}
