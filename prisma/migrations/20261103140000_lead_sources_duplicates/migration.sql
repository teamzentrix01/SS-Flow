ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "gstin" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "phone_normalized" TEXT;

CREATE INDEX IF NOT EXISTS "leads_plant_id_phone_normalized_idx" ON "leads" ("plant_id", "phone_normalized");
CREATE INDEX IF NOT EXISTS "leads_plant_id_gstin_idx" ON "leads" ("plant_id", "gstin");

UPDATE "leads"
SET "phone_normalized" = RIGHT(regexp_replace("phone", '[^0-9]', '', 'g'), 10)
WHERE "phone_normalized" IS NULL AND "phone" IS NOT NULL AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 10;

UPDATE "leads"
SET "priority" = CASE
  WHEN lower("priority") IN ('urgent', 'high') THEN 'HOT'
  WHEN lower("priority") = 'low' THEN 'COLD'
  WHEN lower("priority") IN ('hot', 'warm', 'cold') THEN upper("priority")
  ELSE 'WARM'
END;

ALTER TABLE "leads" ALTER COLUMN "priority" SET DEFAULT 'WARM';
