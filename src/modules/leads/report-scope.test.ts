import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLeadReportScope } from "./report-scope";
import type { SessionUser } from "@/lib/auth/session";

function session(partial: Partial<SessionUser>): SessionUser {
  return {
    userId: "u1",
    email: "a@b.com",
    name: "Test",
    employeeId: "emp1",
    plantIds: ["p1"],
    permissions: new Set(),
    roles: new Set(),
    ...partial,
  };
}

describe("lead report scope", () => {
  it("managers see all unless assignee filter passed", () => {
    const s = session({ roles: new Set(["manager"]), permissions: new Set(["lead.view"]) });
    assert.deepEqual(resolveLeadReportScope(s), { scopedToSelf: false });
    assert.deepEqual(resolveLeadReportScope(s, "other-emp"), {
      assigneeId: "other-emp",
      scopedToSelf: false,
    });
  });

  it("view-only sales exec sees own assignee only", () => {
    const s = session({ permissions: new Set(["lead.view"]), employeeId: "emp1" });
    assert.deepEqual(resolveLeadReportScope(s, "other"), {
      assigneeId: "emp1",
      scopedToSelf: true,
    });
  });
});
