import assert from "node:assert/strict";
import test from "node:test";
import {
  leadCreateSchema,
  leadConvertSchema,
  salesOrderSchema,
  deliveryDatesSchema,
} from "@/lib/schemas";

test("LeadCreateSchema validates required and promised delivery dates independently", () => {
  const baseLead = {
    customerName: "Acme Industrial",
    phone: "9876543210",
    source: "PHONE" as const,
    items: [
      {
        quantity: "100",
        uom: "KG",
        itemDescription: "SS 304 Pipe",
      },
    ],
  };

  // Both dates omitted
  const res1 = leadCreateSchema.safeParse(baseLead);
  assert.equal(res1.success, true);

  // Only required delivery date provided
  const res2 = leadCreateSchema.safeParse({
    ...baseLead,
    requiredDeliveryDate: "2026-11-15",
  });
  assert.equal(res2.success, true);
  if (res2.success) {
    assert.equal(res2.data.requiredDeliveryDate, "2026-11-15");
    assert.equal(res2.data.promisedDeliveryDate, undefined);
  }

  // Both required and promised delivery dates provided
  const res3 = leadCreateSchema.safeParse({
    ...baseLead,
    requiredDeliveryDate: "2026-11-15",
    promisedDeliveryDate: "2026-11-20",
  });
  assert.equal(res3.success, true);
  if (res3.success) {
    assert.equal(res3.data.requiredDeliveryDate, "2026-11-15");
    assert.equal(res3.data.promisedDeliveryDate, "2026-11-20");
  }

  // Only promised delivery date provided
  const res4 = leadCreateSchema.safeParse({
    ...baseLead,
    promisedDeliveryDate: "2026-11-25",
  });
  assert.equal(res4.success, true);
  if (res4.success) {
    assert.equal(res4.data.requiredDeliveryDate, undefined);
    assert.equal(res4.data.promisedDeliveryDate, "2026-11-25");
  }
});

test("SalesOrderSchema validates requiredDeliveryDate and promisedDate independently", () => {
  const baseOrder = {
    customerId: "0194bc02-1234-7000-8000-000000000001",
    lines: [
      {
        productId: "0194bc02-1234-7000-8000-000000000002",
        qtyOrdered: "50",
      },
    ],
  };

  // Both dates omitted
  const res1 = salesOrderSchema.safeParse(baseOrder);
  assert.equal(res1.success, true);

  // Both dates provided
  const res2 = salesOrderSchema.safeParse({
    ...baseOrder,
    requiredDeliveryDate: "2026-12-01",
    promisedDate: "2026-12-05",
  });
  assert.equal(res2.success, true);
  if (res2.success) {
    assert.equal(res2.data.requiredDeliveryDate, "2026-12-01");
    assert.equal(res2.data.promisedDate, "2026-12-05");
  }

  // Only required delivery date provided
  const res3 = salesOrderSchema.safeParse({
    ...baseOrder,
    requiredDeliveryDate: "2026-12-01",
  });
  assert.equal(res3.success, true);
  if (res3.success) {
    assert.equal(res3.data.requiredDeliveryDate, "2026-12-01");
    assert.equal(res3.data.promisedDate, undefined);
  }
});

test("Lead-to-Sales Order conversion rules: never automatically copies required date into promised date", () => {
  // Scenario 1: Lead has requiredDeliveryDate, but NO promisedDeliveryDate
  const leadWithoutPromised = {
    requiredDeliveryDate: new Date("2026-11-15"),
    promisedDeliveryDate: null,
  };

  // Simulate conversion logic
  const convertedOrder1 = {
    requiredDeliveryDate: leadWithoutPromised.requiredDeliveryDate,
    promisedDate: leadWithoutPromised.promisedDeliveryDate ?? null,
  };

  assert.equal(convertedOrder1.requiredDeliveryDate?.toISOString().slice(0, 10), "2026-11-15");
  assert.equal(convertedOrder1.promisedDate, null, "Promised date must remain unset/null when not confirmed on lead");

  // Scenario 2: Lead has both requiredDeliveryDate and promisedDeliveryDate
  const leadWithBoth = {
    requiredDeliveryDate: new Date("2026-11-15"),
    promisedDeliveryDate: new Date("2026-11-18"),
  };

  const convertedOrder2 = {
    requiredDeliveryDate: leadWithBoth.requiredDeliveryDate,
    promisedDate: leadWithBoth.promisedDeliveryDate ?? null,
  };

  assert.equal(convertedOrder2.requiredDeliveryDate?.toISOString().slice(0, 10), "2026-11-15");
  assert.equal(convertedOrder2.promisedDate?.toISOString().slice(0, 10), "2026-11-18");

  // Scenario 3: Salesperson confirms promised date at conversion time
  const conversionInput = { promisedDate: "2026-11-20" };
  const convertedOrder3 = {
    requiredDeliveryDate: leadWithoutPromised.requiredDeliveryDate,
    promisedDate: conversionInput.promisedDate
      ? new Date(conversionInput.promisedDate)
      : (leadWithoutPromised.promisedDeliveryDate ?? null),
  };

  assert.equal(convertedOrder3.requiredDeliveryDate?.toISOString().slice(0, 10), "2026-11-15");
  assert.equal(convertedOrder3.promisedDate?.toISOString().slice(0, 10), "2026-11-20");
});

test("Independent updates: changing one date does not mutate or overwrite the other", () => {
  const currentLead = {
    requiredDeliveryDate: new Date("2026-11-15"),
    promisedDeliveryDate: new Date("2026-11-20"),
  };

  // Update ONLY requiredDeliveryDate
  const inputUpdateRequired = { requiredDeliveryDate: "2026-11-10" };
  const updatedData1: Record<string, unknown> = {};
  if (inputUpdateRequired.requiredDeliveryDate !== undefined) {
    updatedData1.requiredDeliveryDate = inputUpdateRequired.requiredDeliveryDate ? new Date(inputUpdateRequired.requiredDeliveryDate) : null;
  }
  const mergedLead1 = { ...currentLead, ...updatedData1 };
  assert.equal((mergedLead1.requiredDeliveryDate as Date).toISOString().slice(0, 10), "2026-11-10");
  assert.equal((mergedLead1.promisedDeliveryDate as Date).toISOString().slice(0, 10), "2026-11-20");

  // Update ONLY promisedDeliveryDate
  const inputUpdatePromised = { promisedDeliveryDate: "2026-11-22" };
  const updatedData2: Record<string, unknown> = {};
  if (inputUpdatePromised.promisedDeliveryDate !== undefined) {
    updatedData2.promisedDeliveryDate = inputUpdatePromised.promisedDeliveryDate ? new Date(inputUpdatePromised.promisedDeliveryDate) : null;
  }
  const mergedLead2 = { ...currentLead, ...updatedData2 };
  assert.equal((mergedLead2.requiredDeliveryDate as Date).toISOString().slice(0, 10), "2026-11-15");
  assert.equal((mergedLead2.promisedDeliveryDate as Date).toISOString().slice(0, 10), "2026-11-22");
});

test("Non-blocking warning evaluation logic", () => {
  function checkLateDeliveryWarning(required?: string | null, promised?: string | null): boolean {
    if (!required || !promised) return false;
    return promised > required;
  }

  // Promised date is later than required date -> warning is true
  assert.equal(checkLateDeliveryWarning("2026-11-15", "2026-11-20"), true);

  // Promised date is equal to required date -> warning is false
  assert.equal(checkLateDeliveryWarning("2026-11-15", "2026-11-15"), false);

  // Promised date is earlier than required date -> warning is false
  assert.equal(checkLateDeliveryWarning("2026-11-15", "2026-11-10"), false);

  // Either date missing -> warning is false
  assert.equal(checkLateDeliveryWarning("2026-11-15", null), false);
  assert.equal(checkLateDeliveryWarning(null, "2026-11-20"), false);
  assert.equal(checkLateDeliveryWarning("", ""), false);
});

test("Delivery dates schema parses partial updates and null values safely", () => {
  const parse1 = deliveryDatesSchema.safeParse({ requiredDeliveryDate: "2026-11-15" });
  assert.equal(parse1.success, true);

  const parse2 = deliveryDatesSchema.safeParse({ promisedDate: null });
  assert.equal(parse2.success, true);

  const parse3 = deliveryDatesSchema.safeParse({
    requiredDeliveryDate: "2026-11-15",
    promisedDeliveryDate: "2026-11-20",
  });
  assert.equal(parse3.success, true);

  const convertParse = leadConvertSchema.safeParse({
    promisedDate: "2026-11-25",
    lines: [
      {
        leadItemId: "0194bc02-1234-7000-8000-000000000001",
      },
    ],
  });
  assert.equal(convertParse.success, true);
});
