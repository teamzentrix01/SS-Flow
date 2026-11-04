ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMPTZ(6);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_contacted_at" TIMESTAMPTZ(6);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_response_minutes" INTEGER;

UPDATE "leads" SET "last_activity_at" = COALESCE("last_activity_at", "updated_at");

UPDATE "leads" l
SET "first_contacted_at" = sub.first_at
FROM (
  SELECT "lead_id", MIN("created_at") AS first_at
  FROM "lead_status_history"
  WHERE "new_status" IN ('CONTACTED', 'FOLLOW_UP')
  GROUP BY "lead_id"
) sub
WHERE l."id" = sub."lead_id" AND l."first_contacted_at" IS NULL;

UPDATE "leads"
SET "first_response_minutes" = GREATEST(
  0,
  FLOOR(EXTRACT(EPOCH FROM ("first_contacted_at" - "created_at")) / 60)::INTEGER
)
WHERE "first_contacted_at" IS NOT NULL AND "first_response_minutes" IS NULL;

CREATE INDEX IF NOT EXISTS "leads_plant_id_last_activity_at_idx" ON "leads" ("plant_id", "last_activity_at");
