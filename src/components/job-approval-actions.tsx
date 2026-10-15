"use client";

import Link from "next/link";
import { IdAction } from "@/components/forms";

export function JobApprovalActions({
  jobId,
  jobLabel,
}: {
  jobId: string;
  jobLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link href={`/jobs/${jobId}`} className="text-sm text-accent hover:underline">
        Review
      </Link>
      <IdAction
        url={`/api/v1/jobs/${jobId}/approve`}
        label="Approve step"
        confirmText={`Approve ${jobLabel}? This closes the step and unlocks the next operation for the operator.`}
        redirectTo="/job-approvals"
      />
    </div>
  );
}
