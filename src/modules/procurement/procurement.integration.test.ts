import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  sendPurchaseOrder,
} from "./purchase-orders";
import { createGoodsReceipt, postGoodsReceipt, receiveAndPostGoods } from "./goods-receipts";
import {
  INTEGRATION_ENABLED,
  loadProcurementFixture,
  teardownProcurementFixture,
  testSession,
  type FixtureIds,
} from "./integration-fixtures";

const skip = !INTEGRATION_ENABLED;

function key() {
  return uuidv7();
}

async function readyOrder(session: ReturnType<typeof testSession>, ids: FixtureIds) {
  const created = await createPurchaseOrder(
    session,
    {
      plantId: ids.plantId,
      supplierId: ids.supplierId,
      submit: true,
      lines: [{ materialId: ids.materialId, qty: "100", rate: "50" }],
    },
    key(),
  );
  ids.orderIds.push(created.id);
  await approvePurchaseOrder(session, created.id, key());
  await sendPurchaseOrder(session, created.id, key());
  return created.id;
}

test("procurement integration suite", { skip: skip ? "Set PROCUREMENT_INTEGRATION=1" : false }, async (t) => {
  const runId = uuidv7();
  const ids = await loadProcurementFixture(runId);
  const session = testSession(ids.plantId, ids.userId);
  try {
    await t.test("partial receipt then full receipt updates PO status", async () => {
      const orderId = await readyOrder(session, ids);
      const first = await receiveAndPostGoods(
        session,
        {
          orderId,
          locationId: ids.locationId,
          lines: [{ orderItemId: (await lineId(orderId))!, qty: "40", batchNo: `B-${runId.slice(0, 6)}-1` }],
        },
        key(),
      );
      ids.receiptIds.push(first.id);
      let order = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      assert.equal(order.status, "partial");
      assert.equal(Number(order.items[0]!.receivedQty), 40);
      const second = await receiveAndPostGoods(
        session,
        {
          orderId,
          locationId: ids.locationId,
          lines: [{ orderItemId: order.items[0]!.id, qty: "60", batchNo: `B-${runId.slice(0, 6)}-2` }],
        },
        key(),
      );
      ids.receiptIds.push(second.id);
      const closed = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: orderId } });
      assert.equal(closed.status, "received");
    });

    await t.test("draft GRN does not increase received until post", async () => {
      const orderId = await readyOrder(session, ids);
      const itemId = await lineId(orderId);
      const draft = await createGoodsReceipt(
        session,
        {
          orderId,
          locationId: ids.locationId,
          lines: [
            {
              orderItemId: itemId!,
              deliveredQty: "25",
              acceptedQty: "25",
              rejectedQty: "0",
              batchNo: `D-${runId.slice(0, 6)}`,
            },
          ],
        },
        key(),
      );
      ids.receiptIds.push(draft.id);
      const before = await prisma.purchaseOrderItem.findFirstOrThrow({ where: { orderId } });
      assert.equal(Number(before.receivedQty), 0);
      await postGoodsReceipt(session, draft.id, key());
      const after = await prisma.purchaseOrderItem.findFirstOrThrow({ where: { orderId } });
      assert.equal(Number(after.receivedQty), 25);
    });

    await t.test("duplicate post is rejected", async () => {
      const orderId = await readyOrder(session, ids);
      const posted = await receiveAndPostGoods(
        session,
        {
          orderId,
          locationId: ids.locationId,
          lines: [{ orderItemId: (await lineId(orderId))!, qty: "10", batchNo: `P-${runId.slice(0, 6)}` }],
        },
        key(),
      );
      ids.receiptIds.push(posted.id);
      await assert.rejects(
        () => postGoodsReceipt(session, posted.id, key()),
        (error: unknown) => error instanceof AppError && error.code === "ALREADY_POSTED",
      );
    });

    await t.test("over-receipt is rejected", async () => {
      const orderId = await readyOrder(session, ids);
      const orderItemId = (await lineId(orderId))!;
      await assert.rejects(
        () =>
          receiveAndPostGoods(
            session,
            {
              orderId,
              locationId: ids.locationId,
              lines: [{ orderItemId, qty: "150", batchNo: `O-${runId.slice(0, 6)}` }],
            },
            key(),
          ),
        (error: unknown) => error instanceof AppError && error.code === "OVER_RECEIPT",
      );
    });

    await t.test("cancel with reason on approved PO", async () => {
      const created = await createPurchaseOrder(
        session,
        {
          plantId: ids.plantId,
          supplierId: ids.supplierId,
          submit: true,
          lines: [{ materialId: ids.materialId, qty: "10", rate: "1" }],
        },
        key(),
      );
      ids.orderIds.push(created.id);
      await approvePurchaseOrder(session, created.id, key());
      await cancelPurchaseOrder(session, created.id, "Supplier cannot deliver in time", key());
      const order = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: created.id } });
      assert.equal(order.status, "cancelled");
      assert.ok(order.cancelledAt);
    });
  } finally {
    const receipts = await prisma.goodsReceipt.findMany({
      where: { orderId: { in: ids.orderIds } },
      select: { id: true },
    });
    ids.receiptIds.push(...receipts.map((row) => row.id).filter((id) => !ids.receiptIds.includes(id)));
    await teardownProcurementFixture(ids);
  }
});

async function lineId(orderId: string) {
  const item = await prisma.purchaseOrderItem.findFirst({ where: { orderId } });
  return item?.id;
}
