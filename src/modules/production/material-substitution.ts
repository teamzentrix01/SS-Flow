export function validateSubstitutionDecision(input: {
  status: string;
  requestedBy: string;
  actorId: string;
  canApprove: boolean;
  decision: "approve" | "reject";
  reason?: string;
}) {
  if (!input.canApprove) return "FORBIDDEN" as const;
  if (input.status !== "pending") return "INVALID_STATE" as const;
  if (input.requestedBy === input.actorId) return "SEPARATION_OF_DUTIES" as const;
  if (input.decision === "reject" && !input.reason?.trim()) return "REJECTION_REASON_REQUIRED" as const;
  return null;
}
