ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "repeat_order_follow_up_days" INTEGER;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "repeat_order_follow_up_days" INTEGER;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "repeat_order_follow_up_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "leads_repeat_order_follow_up_at_idx"
  ON "leads"("repeat_order_follow_up_at")
  WHERE "status" = 'CONVERTED' AND "repeat_order_follow_up_at" IS NOT NULL;
