"use client";

import { useState } from "react";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { FormFeedback } from "@/components/form-feedback";

export function SalesOrderDatesEditor({
  orderId,
  requiredDeliveryDate,
  promisedDate,
}: {
  orderId: string;
  requiredDeliveryDate?: string | null;
  promisedDate?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [requiredDate, setRequiredDate] = useState(requiredDeliveryDate || "");
  const [promised, setPromised] = useState(promisedDate || "");
  const { post, pending, error, success } = usePost();

  const isPromisedLate = Boolean(requiredDate && promised && promised > requiredDate);

  if (!open) {
    return (
      <Button tone="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>
        Edit delivery dates
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-sm">Update Delivery Dates</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Required delivery date" detail="Customer requested date">
          <input
            className={controlClass}
            type="date"
            value={requiredDate}
            onChange={(e) => setRequiredDate(e.target.value)}
          />
        </Field>
        <Field label="Promised delivery date" detail="SS-Metals commitment">
          <input
            className={controlClass}
            type="date"
            value={promised}
            onChange={(e) => setPromised(e.target.value)}
          />
        </Field>
      </div>
      {isPromisedLate ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Notice: Promised delivery date ({promised}) is later than customer&apos;s required delivery date ({requiredDate}).
        </p>
      ) : null}
      <FormFeedback error={error} success={success} />
      <div className="flex gap-2">
        <Button
          pending={pending}
          onClick={() =>
            void post(
              `/api/v1/sales/orders/${orderId}/dates`,
              {
                requiredDeliveryDate: requiredDate || null,
                promisedDate: promised || null,
              },
              { successMessage: "Delivery dates updated." },
            )
          }
        >
          Save delivery dates
        </Button>
        <Button tone="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
