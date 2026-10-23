import { LeadCreateForm } from "@/components/leads/lead-create-form";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listEmployees, listSalesOrderCustomers, listSalesOrderProducts, listCategories, listGrades, listUoms } from "@/lib/queries";

export default async function NewLeadPage() {
  const session = await requirePage("lead.manage");
  const [customers, employees, products, categories, grades, uoms] = await Promise.all([
    listSalesOrderCustomers(session.plantIds),
    listEmployees(session.plantIds),
    listSalesOrderProducts(session.plantIds),
    listCategories(session.plantIds),
    listGrades(session.plantIds),
    listUoms(session.plantIds),
  ]);
  return (
    <DeskFormPage title="New lead" detail="Record a visit, call, or referral enquiry." backHref="/leads" boxed={false} wide>
      <LeadCreateForm
        customers={customers}
        employees={employees.filter((e: any) => e.id != null).map((e: any) => ({ id: e.id!, name: e.name }))}
        products={products}
        categories={categories}
        grades={grades}
        uoms={uoms}
      />
    </DeskFormPage>
  );
}
