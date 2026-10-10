export function predecessorsClosed(statuses: string[]) {
  return statuses.every((status) => status === "closed");
}

export function canStartJob(input: {
  status: string;
  approvalStatus: string;
  assigneeId: string | null;
  actorEmployeeId: string | null;
  predecessors: string[];
  machineBlocked: boolean;
}) {
  if (!input.actorEmployeeId || input.actorEmployeeId !== input.assigneeId) {
    return "FORBIDDEN";
  }
  if (input.machineBlocked) return "MACHINE_BLOCKED";
  if (!predecessorsClosed(input.predecessors)) return "DEPENDENCY_OPEN";
  const sentBack = input.status === "in_progress" && input.approvalStatus === "rejected";
  if (input.status !== "ready" && !sentBack) return "INVALID_STATE";
  return null;
}

export function quantitiesReconcile(input: {
  consumed: bigint;
  good: bigint;
  reject: bigint;
  scrap: bigint;
}) {
  if (input.consumed < 0n || input.good < 0n || input.reject < 0n || input.scrap < 0n) {
    return "QTY_INVALID";
  }
  const total = input.good + input.reject + input.scrap;
  const gap = total > input.consumed ? total - input.consumed : input.consumed - total;
  const tolerance = input.consumed / 50n > 500n ? input.consumed / 50n : 500n;
  if (gap > tolerance) return "QTY_MISMATCH";
  return null;
}

export function thicknessWithinTolerance(measured: number, target: number, tolerance = 0.05) {
  return Math.abs(measured - target) <= tolerance;
}
