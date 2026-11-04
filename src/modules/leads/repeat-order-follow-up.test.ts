import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultRepeatOrderFollowUpDays,
  resolveRepeatOrderFollowUpDays,
} from "./repeat-order-follow-up";

describe("repeat order follow-up", () => {
  it("uses lead override, then customer, then env default", () => {
    process.env.REPEAT_ORDER_FOLLOW_UP_DAYS = "30";
    assert.equal(resolveRepeatOrderFollowUpDays({ leadDays: 45, customerDays: 60 }), 45);
    assert.equal(resolveRepeatOrderFollowUpDays({ leadDays: null, customerDays: 60 }), 60);
    assert.equal(resolveRepeatOrderFollowUpDays({}), defaultRepeatOrderFollowUpDays());
    delete process.env.REPEAT_ORDER_FOLLOW_UP_DAYS;
  });
});
