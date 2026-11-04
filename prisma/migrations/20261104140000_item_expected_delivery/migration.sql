ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "expected_delivery_date" DATE;
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "expected_delivery_date" DATE;
