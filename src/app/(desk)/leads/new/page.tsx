import { LeadCreateForm } from "@/components/leads/lead-create-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listEmployees, listSalesOrderCustomers, listSalesOrderProducts } from "@/lib/queries";

export default async function NewLeadPage() {
  const session = await requirePage("lead.manage");
  const [customers, employees, products] = await Promise.all([
    listSalesOrderCustomers(session.plantIds),
    listEmployees(session.plantIds),
    listSalesOrderProducts(session.plantIds),
  ]);
  return (
    <DeskFormPage title="New lead" detail="Record a visit, call, or referral enquiry." backHref="/leads">
      <LeadCreateForm
        customers={customers}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        products={products}
      />
    </DeskFormPage>
  );
}
