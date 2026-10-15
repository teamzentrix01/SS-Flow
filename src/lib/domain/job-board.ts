/** Roll-up status for a production order’s routing steps (job cards). */
export type JobBoardRollupStatus =
  | "completed"
  | "in_progress"
  | "awaiting_approval"
  | "not_started"
  | "cancelled";

export function rollupProductionJobStatus(
  jobs: { status: string; name: string; sequence: number; closedAt?: Date | null }[],
): {
  code: JobBoardRollupStatus;
  label: string;
  completedAt: Date | null;
  currentStepName: string | null;
  stepCount: number;
  closedCount: number;
} {
  const steps = jobs.filter((j) => j.status !== "cancelled");
  if (!steps.length) {
    return {
      code: "cancelled",
      label: "Cancelled",
      completedAt: null,
      currentStepName: null,
      stepCount: 0,
      closedCount: 0,
    };
  }

  const closedCount = steps.filter((j) => j.status === "closed").length;
  const allClosed = closedCount === steps.length;
  const completedAt = allClosed
    ? steps.reduce<Date | null>((latest, j) => {
        if (!j.closedAt) return latest;
        if (!latest || j.closedAt > latest) return j.closedAt;
        return latest;
      }, null)
    : null;

  if (allClosed) {
    return {
      code: "completed",
      label: "Completed",
      completedAt,
      currentStepName: null,
      stepCount: steps.length,
      closedCount,
    };
  }

  const current = steps.find((j) => j.status !== "closed");
  const currentStepName = current?.name ?? null;

  if (steps.some((j) => j.status === "in_progress" || j.status === "paused")) {
    return {
      code: "in_progress",
      label: "In process",
      completedAt: null,
      currentStepName,
      stepCount: steps.length,
      closedCount,
    };
  }

  if (steps.some((j) => j.status === "submitted")) {
    return {
      code: "awaiting_approval",
      label: "Awaiting approval",
      completedAt: null,
      currentStepName,
      stepCount: steps.length,
      closedCount,
    };
  }

  if (closedCount > 0 || steps.some((j) => ["ready", "assigned"].includes(j.status))) {
    return {
      code: "in_progress",
      label: "In process",
      completedAt: null,
      currentStepName,
      stepCount: steps.length,
      closedCount,
    };
  }

  return {
    code: "not_started",
    label: "Not started",
    completedAt: null,
    currentStepName: steps[0]?.name ?? null,
    stepCount: steps.length,
    closedCount,
  };
}

export function rollupStatusTone(code: JobBoardRollupStatus) {
  if (code === "completed") return "success" as const;
  if (code === "cancelled") return "danger" as const;
  if (code === "awaiting_approval") return "warning" as const;
  if (code === "in_progress") return "warning" as const;
  return "info" as const;
}
