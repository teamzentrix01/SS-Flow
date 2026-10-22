import { SalesOrderForm } from "@/components/forms";
import { CreateDialog } from "@/components/create-dialog";
import { CustomerForm } from "@/components/master-forms";
import { EmptyState, PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor, when } from "@/lib/format";
import { ensurePortalCustomerRecords } from "@/lib/masters";
import { listSalesOrderCustomers, listSalesOrderProducts, listSalesOrders } from "@/lib/queries";

export default async function SalesPage() {
  const session = await requirePage("sales.view");
  if (session.permissions.has("sales.manage")) {
    await ensurePortalCustomerRecords(session.plantIds, session.userId);
  }
  const [orders, customers, products] = await Promise.all([
    listSalesOrders(session.plantIds),
    listSalesOrderCustomers(session.plantIds),
    listSalesOrderProducts(session.plantIds),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales orders"
        detail="Manufactured products explode a BOM on approve. Purchased stock such as coil is reserved and sent to dispatch."
        action={
          session.permissions.has("sales.manage") ? (
            <CreateDialog label="Create sales order" title="Create sales order">
              <SalesOrderForm customers={customers} products={products} />
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
          rowKeys={orders.map((order) => order.id)}
          rowHrefs={orders.map((order) => `/sales/${order.id}`)}
          rows={orders.map((order) => [
            order.number,
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
