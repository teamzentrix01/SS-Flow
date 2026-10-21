-- Purchase order workflow extensions (non-destructive)

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_terms" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "delivery_terms" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "cancelled_by" UUID;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "purchase_orders_plant_id_supplier_id_created_at_idx"
  ON "purchase_orders" ("plant_id", "supplier_id", "created_at" DESC);

ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "diameter" DECIMAL(18,3);
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "finish" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "rejected_qty" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "tax_pct" DECIMAL(8,4) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "specs" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "posted_at" TIMESTAMPTZ;
ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "posted_by" UUID;

CREATE INDEX IF NOT EXISTS "goods_receipts_order_id_status_idx"
  ON "goods_receipts" ("order_id", "status");

ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "delivered_qty" DECIMAL(18,3);
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "accepted_qty" DECIMAL(18,3);
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "rejected_qty" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "uom" TEXT NOT NULL DEFAULT 'KG';
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "actual_weight" DECIMAL(18,3);
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "inspection_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

UPDATE "goods_receipt_items"
SET
  "delivered_qty" = COALESCE("delivered_qty", "qty"),
  "accepted_qty" = COALESCE("accepted_qty", "qty"),
  "rejected_qty" = COALESCE("rejected_qty", 0)
WHERE "delivered_qty" IS NULL OR "accepted_qty" IS NULL;

UPDATE "goods_receipts"
SET
  "status" = 'posted',
  "posted_at" = COALESCE("posted_at", "received_at"),
  "posted_by" = COALESCE("posted_by", "received_by")
WHERE "posted_at" IS NULL;

ALTER TABLE "goods_receipt_items" ALTER COLUMN "batch_id" DROP NOT NULL;
ALTER TABLE "goods_receipt_items" ALTER COLUMN "location_id" DROP NOT NULL;

ALTER TABLE "goods_receipt_items" ALTER COLUMN "delivered_qty" SET NOT NULL;
ALTER TABLE "goods_receipt_items" ALTER COLUMN "accepted_qty" SET NOT NULL;

ALTER TABLE "stock_ledger" ADD COLUMN IF NOT EXISTS "reference_line_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "stock_ledger_reference_line_id_key"
  ON "stock_ledger" ("reference_line_id")
  WHERE "reference_line_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "goods_receipt_items_receipt_id_idx"
  ON "goods_receipt_items" ("receipt_id");
