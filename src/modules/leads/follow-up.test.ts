import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNextFollowUpForStatus,
  firstContactMetrics,
  isFollowUpOverdue,
  leadStaleLevel,
  LEAD_STALE_CRITICAL_DAYS,
  LEAD_STALE_WARNING_DAYS,
} from "@/modules/leads/follow-up";

test("follow-up required on key stage transitions", () => {
  assert.throws(() => assertNextFollowUpForStatus("CONTACTED", null));
  assert.doesNotThrow(() => assertNextFollowUpForStatus("CONTACTED", new Date()));
  assert.doesNotThrow(() => assertNextFollowUpForStatus("ON_HOLD", null));
});

test("first response minutes captured once from NEW", () => {
  const created = new Date("2026-01-01T10:00:00Z");
  const at = new Date("2026-01-01T10:45:00Z");
  const patch = firstContactMetrics(
    { status: "NEW", createdAt: created, firstContactedAt: null, firstResponseMinutes: null },
    "CONTACTED",
    at,
  );
  assert.equal(patch.firstResponseMinutes, 45);
  assert.ok(patch.firstContactedAt);
});

test("stale levels use configured day thresholds", () => {
  const now = new Date("2026-02-15T12:00:00Z");
  const active = new Date(now.getTime() - 3 * 86400000);
  const warn = new Date(now.getTime() - LEAD_STALE_WARNING_DAYS * 86400000);
  const critical = new Date(now.getTime() - LEAD_STALE_CRITICAL_DAYS * 86400000);
  assert.equal(leadStaleLevel("CONTACTED", active, now), "none");
  assert.equal(leadStaleLevel("CONTACTED", warn, now), "warning");
  assert.equal(leadStaleLevel("CONTACTED", critical, now), "critical");
  assert.equal(leadStaleLevel("CONVERTED", critical, now), "none");
});

test("overdue follow-up detection", () => {
  assert.equal(isFollowUpOverdue("CONTACTED", new Date("2020-01-01"), new Date("2026-01-01")), true);
  assert.equal(isFollowUpOverdue("CONVERTED", new Date("2020-01-01"), new Date("2026-01-01")), false);
});
