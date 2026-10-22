import {
  SalesOrderFlowSteps,
  SalesOrderJobAssignPanel,
  type SalesOrderJobRow,
} from "@/components/sales-order-production";
import { SimpleTable } from "@/components/ui";
import { salesLineRequiresBom } from "@/lib/domain/master-entities";
import { labelFor } from "@/lib/format";
import { listDies, listEmployees, listMachines } from "@/lib/queries";
import type { SessionUser } from "@/lib/auth/session";

type SalesOrderWithProduction = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/queries").salesOrderDetail>>
>;

export async function SalesOrderProductionSection({
  order,
  session,
}: {
  order: SalesOrderWithProduction;
  session: SessionUser;
}) {
  const canAssign = session.permissions.has("job.assign");
  const [employees, machines, dies] = canAssign
    ? await Promise.all([
        listEmployees(session.plantIds),
        listMachines(session.plantIds),
        listDies(session.plantIds),
      ])
    : [[], [], []];

  const jobs: SalesOrderJobRow[] = order.jobCards.map((job) => {
    const blocker = job.predecessors.find((link) => link.predecessor.status !== "closed");
    return {
      id: job.id,
      number: job.number,
      name: job.name,
      sequence: job.sequence,
      status: job.status,
      targetQty: job.targetQty.toString(),
      targetUom: job.uom,
      instructions: job.instructions,
      assignee: job.assignee
        ? {
            id: job.assignee.id,
            name: job.assignee.name,
            code: job.assignee.code,
            phone: job.assignee.phone,
            designation: job.assignee.designation,
            shiftName: job.assignee.shift?.name ?? null,
            departmentName: job.assignee.department?.name ?? null,
          }
        : null,
      machine: job.machine ? { code: job.machine.code, name: job.machine.name } : null,
      die: job.die ? { code: job.die.code, name: job.die.name } : null,
      plannedStart: job.plannedStart?.toISOString() ?? null,
      plannedEnd: job.plannedEnd?.toISOString() ?? null,
      productionOrder: {
        id: job.productionOrder.id,
        number: job.productionOrder.number,
        status: job.productionOrder.status,
      },
      productName: job.salesOrderItem?.product.name ?? job.productionOrder.product.name,
      locked: Boolean(blocker),
      lockedBy: blocker?.predecessor.number ?? null,
      approvalStatus: job.approvalStatus,
      goodQty: job.goodQty.toString(),
      closedAt: job.closedAt?.toISOString() ?? null,
      stageComplete: job.status === "closed",
      awaitingApproval: job.status === "submitted",
    };
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-semibold">Fulfillment flow</h2>
        <SalesOrderFlowSteps
          status={order.status}
          stockSale={order.items.every((line) => !salesLineRequiresBom(line.product))}
        />
      </section>

      {order.productionOrders.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Production orders</h2>
          <SimpleTable
            columns={["MO", "Product", "Status", "Detail"]}
            rowKeys={order.productionOrders.map((mo) => mo.id)}
            rowHrefs={order.productionOrders.map((mo) => `/production/${mo.id}`)}
            rows={order.productionOrders.map((mo) => [
              mo.number,
              mo.product.name,
              labelFor(mo.status),
              mo.status === "completed" ? "Finished goods posted" : "Released for shop",
            ])}
          />
        </section>
      ) : null}

      <SalesOrderJobAssignPanel
        salesOrderId={order.id}
        jobs={jobs}
        canAssign={canAssign}
        employees={employees.map((row) => ({ id: row.id, name: row.name }))}
        machines={machines.map((row) => ({
          id: row.id,
          name: `${row.code} · ${row.name}`,
        }))}
        dies={dies.map((row) => ({ id: row.id, name: row.code }))}
      />
    </div>
  );
}
