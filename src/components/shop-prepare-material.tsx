"use client";

import { IdAction } from "@/components/forms";

export function ShopPrepareMaterial({
  jobId,
  redirectTo,
}: {
  jobId: string;
  redirectTo: string;
}) {
  return (
    <IdAction
      url={`/api/v1/jobs/${jobId}/prepare-material`}
      label="Reserve material from stock"
      redirectTo={redirectTo}
      confirmText="Reserve available raw material for this job from inventory?"
    />
  );
}
