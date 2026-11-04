ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lost_reason_code" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lost_reason_note" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "competitor_name" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "competitor_rate" DECIMAL(18,2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "customer_target_rate" DECIMAL(18,2);

UPDATE "leads"
SET
  "lost_reason_code" = 'OTHER',
  "lost_reason_note" = "lost_reason"
WHERE
  "status" IN ('LOST', 'REJECTED')
  AND "lost_reason" IS NOT NULL
  AND TRIM("lost_reason") <> ''
  AND ("lost_reason_code" IS NULL OR TRIM("lost_reason_code") = '');
