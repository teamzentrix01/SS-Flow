-- order type: STANDARD -> READY_STOCK
UPDATE "leads" SET "order_type" = 'READY_STOCK' WHERE "order_type" IS NULL OR "order_type" = 'STANDARD';
ALTER TABLE "leads" ALTER COLUMN "order_type" SET DEFAULT 'READY_STOCK';

ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "mfg_grade" TEXT;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "gauge_thickness_mm" DECIMAL(18,3);
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "weight_per_piece_grams" DECIMAL(18,3);
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "finish" TEXT;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "size_or_capacity" TEXT;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "packing" TEXT;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "logo_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "artwork_url" TEXT;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "pricing_basis" TEXT;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "in_stock" BOOLEAN;
ALTER TABLE "lead_items" ADD COLUMN IF NOT EXISTS "estimated_lead_time_days" INTEGER;

ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "min_order_qty" DECIMAL(18,3);

ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "po_number" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "po_attachment_url" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "advance_amount" DECIMAL(18,2);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "expected_dispatch_date" DATE;
