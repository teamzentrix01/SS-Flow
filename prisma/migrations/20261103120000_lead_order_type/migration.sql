-- Optional lead classification for custom/manufacturing workflows (Phase 4 will set CUSTOM in UI).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "order_type" TEXT NOT NULL DEFAULT 'STANDARD';

CREATE INDEX IF NOT EXISTS "leads_plant_id_order_type_idx" ON "leads" ("plant_id", "order_type");
