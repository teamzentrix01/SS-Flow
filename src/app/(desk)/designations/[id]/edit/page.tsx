import { DesignationForm } from "@/components/rbac/designation-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listDepartments } from "@/lib/queries";
import { getDesignation } from "@/modules/rbac/designations";
import { notFound } from "next/navigation";

export default async function EditDesignationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("designation.manage");
  const { id } = await params;
  const [row, departments] = await Promise.all([
    getDesignation(id, session.plantIds),
    listDepartments(session.plantIds),
  ]);
  if (!row) notFound();
  return (
    <DeskFormPage title={`Edit ${row.name}`} backHref="/designations" backLabel="Back to designations">
      <p className="mb-4 text-sm text-muted">
        {row._count.employees} employee{row._count.employees === 1 ? "" : "s"} use this designation. Deactivating
        hides it from new assignments but keeps existing links.
      </p>
      <DesignationForm
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        redirectTo="/designations"
        initial={{
          id: row.id,
          name: row.name,
          code: row.code,
          description: row.description ?? "",
          departmentId: row.departmentId ?? "",
          isActive: row.isActive,
        }}
      />
    </DeskFormPage>
  );
}
