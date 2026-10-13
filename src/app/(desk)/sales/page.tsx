import { SalesOrderForm } from "@/components/forms";
import { CreateDialog } from "@/components/create-dialog";
import { CustomerForm } from "@/components/master-forms";
import { EmptyState, PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { listCustomers, listSalesOrders, listUtensilProducts } from "@/lib/queries";

export default async function SalesPage() {
  const session = await requirePage("sales.view");
  const [orders, customers, products] = await Promise.all([
    listSalesOrders(session.plantIds),
    listCustomers(session.plantIds),
    listUtensilProducts(session.plantIds),
  ]);
  const utensilProducts = products.filter((p) => p.category === "utensil");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales orders"
        detail="Make-to-order utensils drive MRP and production when approved."
        action={
          session.permissions.has("sales.manage") ? (
            <CreateDialog label="New order" title="New sales order">
              {customers.length && utensilProducts.length ? (
                <SalesOrderForm
                  customers={customers.map((c) => ({ id: c.id, name: c.name }))}
                  products={utensilProducts.map((p) => ({ id: p.id, name: p.name }))}
                />
              ) : (
                <EmptyState title="Add customer and utensil product first" detail="Create a customer and a utensil product under Masters." />
              )}
            </CreateDialog>
          ) : null
        }
      />
      {!customers.length ? (
        <EmptyState
          title="No customers"
          detail="Create a customer to start sales orders."
          action={session.permissions.has("dispatch.manage") ? <CreateDialog label="Create customer" title="Create customer"><CustomerForm /></CreateDialog> : undefined}
        />
      ) : (
        <SimpleTable
          emptyTitle="No sales orders yet"
          emptyDetail="Create a draft order, submit, then approve to run MRP."
          columns={["Number", "Customer", "Status", "Promised", "Lines"]}
          rows={orders.map((order) => [
            <TextLink key={order.id} href={`/sales/${order.id}`}>{order.number}</TextLink>,
            order.customer.name,
            <StatusBadge key={`${order.id}-s`} label={labelFor(order.status)} tone={toneFor(order.status)} />,
            when(order.promisedDate),
            String(order.items.length),
          ])}
        />
      )}
    </div>
  );
}
