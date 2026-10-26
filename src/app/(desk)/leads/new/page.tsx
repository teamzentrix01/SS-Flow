import { LeadCreateForm } from "@/components/leads/lead-create-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listEmployees, listSalesOrderCustomers, listUoms } from "@/lib/queries";
import { leadProductCatalog } from "@/modules/leads/queries";

export default async function NewLeadPage() {
  const session = await requirePage("lead.manage");
  const [customers, employees, catalog, uoms] = await Promise.all([
    listSalesOrderCustomers(session.plantIds),
    listEmployees(session.plantIds),
    leadProductCatalog(session.plantIds),
    listUoms(session.plantIds),
  ]);
  return (
    <DeskFormPage title="New lead" detail="Record a visit, call, or referral enquiry." backHref="/leads" boxed={false} wide>
      <LeadCreateForm
        customers={customers}
        employees={employees.filter((e: any) => e.id != null).map((e: any) => ({ id: e.id!, name: e.name }))}
        products={catalog.products}
        categories={catalog.categories.map((row) => ({ id: row.id, name: row.name }))}
        uoms={uoms}
        canManageProducts={session.permissions.has("plant.manage")}
      />
    </DeskFormPage>
  );
}
