"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Field, controlClass } from "@/components/ui";
import { FormFeedback } from "@/components/form-feedback";
import { usePost } from "@/components/use-post";

export function InterFactoryCreateForm({
  plants,
  batches,
  locations,
}: {
  plants: { id: string; name: string }[];
  batches: { batchId: string; locationId: string; plantId: string; label: string; uom: string }[];
  locations: { id: string; plantId: string; label: string }[];
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm({
    defaultValues: {
      sourcePlantId: plants[0]?.id ?? "",
      destinationPlantId: plants[1]?.id ?? plants[0]?.id ?? "",
      batchId: "",
      sourceLocationId: "",
      destLocationId: "",
      requestedQty: "",
      uom: "KG",
      notes: "",
    },
  });
  const sourcePlantId = form.watch("sourcePlantId");
  const destPlantId = form.watch("destinationPlantId");
  const sourceBatches = useMemo(() => batches.filter((row) => row.plantId === sourcePlantId), [batches, sourcePlantId]);
  const sourceLocations = useMemo(() => locations.filter((row) => row.plantId === sourcePlantId), [locations, sourcePlantId]);
  const destLocations = useMemo(() => locations.filter((row) => row.plantId === destPlantId), [locations, destPlantId]);

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) => {
        const batch = batches.find((row) => row.batchId === values.batchId);
        return post(
          "/api/v1/inventory/inter-factory-transfers",
          { ...values, uom: batch?.uom ?? values.uom, sourceLocationId: values.sourceLocationId || batch?.locationId },
          { redirectTo: "/inventory/transfer", successMessage: "Transfer request created." },
        );
      })}
    >
      <Field label="Source factory" required>
        <select className={controlClass} {...form.register("sourcePlantId")}>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Destination factory" required>
        <select className={controlClass} {...form.register("destinationPlantId")}>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source batch" required>
        <select className={controlClass} {...form.register("batchId")}>
          <option value="">Select a batch with available stock</option>
          {sourceBatches.map((batch) => (
            <option key={`${batch.batchId}-${batch.locationId}`} value={batch.batchId}>
              {batch.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source location" required>
        <select className={controlClass} {...form.register("sourceLocationId")}>
          {sourceLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Destination location" required>
        <select className={controlClass} {...form.register("destLocationId")}>
          {destLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantity" required>
        <input className={controlClass} {...form.register("requestedQty")} inputMode="decimal" />
      </Field>
      <Field label="Notes">
        <input className={controlClass} {...form.register("notes")} />
      </Field>
      <div className="md:col-span-2">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>Create transfer</Button>
      </div>
    </form>
  );
}

export function TransferActionForm({
  transferId,
  mode,
  defaultQty,
}: {
  transferId: string;
  mode: "approve" | "receive" | "cancel";
  defaultQty: string;
}) {
  const { post, error, success, pending } = usePost();
  const [qty, setQty] = useState(defaultQty);
  const [rejectedQty, setRejectedQty] = useState("0");
  const [notes, setNotes] = useState("");
  const url =
    mode === "approve"
      ? `/api/v1/inventory/inter-factory-transfers/${transferId}/approve`
      : mode === "receive"
        ? `/api/v1/inventory/inter-factory-transfers/${transferId}/receive`
        : `/api/v1/inventory/inter-factory-transfers/${transferId}/cancel`;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const body =
          mode === "approve"
            ? { transferId, dispatchedQty: qty }
            : mode === "receive"
              ? { transferId, receivedQty: qty, rejectedQty, notes }
              : { transferId, reason: notes };
        return post(url, body, { redirectTo: `/inventory/transfers/${transferId}`, successMessage: "Transfer updated." });
      }}
    >
      {mode !== "cancel" ? (
        <Field label={mode === "approve" ? "Dispatch quantity" : "Received quantity"} required>
          <input className={controlClass} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        </Field>
      ) : null}
      {mode === "receive" ? (
        <Field label="Rejected / damaged quantity">
          <input className={controlClass} value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} inputMode="decimal" />
        </Field>
      ) : null}
      {mode !== "approve" ? (
        <Field label={mode === "cancel" ? "Reason" : "Notes"}>
          <input className={controlClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      ) : null}
      <FormFeedback error={error} success={success} />
      <Button pending={pending} tone={mode === "cancel" ? "danger" : "primary"}>
        {mode === "approve" ? "Approve and dispatch" : mode === "receive" ? "Receive transfer" : "Cancel transfer"}
      </Button>
    </form>
  );
}
