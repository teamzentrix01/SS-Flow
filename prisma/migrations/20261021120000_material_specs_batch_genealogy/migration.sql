ALTER TABLE "product_categories"
ADD COLUMN "required_specs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "material_batches"
ADD COLUMN "supplier_batch_no" TEXT,
ADD COLUMN "received_qty" DECIMAL(18,3),
ADD COLUMN "received_uom" TEXT,
ADD COLUMN "actual_weight_kg" DECIMAL(18,3);

ALTER TABLE "goods_receipt_items"
ADD COLUMN "grade" TEXT,
ADD COLUMN "thickness" DECIMAL(18,3),
ADD COLUMN "width" DECIMAL(18,3),
ADD COLUMN "length" DECIMAL(18,3),
ADD COLUMN "diameter" DECIMAL(18,3),
ADD COLUMN "finish" TEXT;

ALTER TABLE "goods_receipt_items"
ADD CONSTRAINT "goods_receipt_items_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_material_issues"
ADD COLUMN "job_id" UUID,
ADD COLUMN "batch_id" UUID,
ADD COLUMN "quantity_consumed" DECIMAL(18,3) NOT NULL DEFAULT 0,
ADD COLUMN "quantity_returned" DECIMAL(18,3) NOT NULL DEFAULT 0;

ALTER TABLE "production_material_issues"
ADD CONSTRAINT "production_material_issues_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "production_material_issues_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "production_material_issues_batch_id_idx" ON "production_material_issues"("batch_id");
CREATE UNIQUE INDEX "production_material_issues_job_id_batch_id_key" ON "production_material_issues"("job_id", "batch_id");

DROP INDEX IF EXISTS "stock_ledger_reference_line_id_key";
CREATE INDEX "stock_ledger_reference_line_id_idx" ON "stock_ledger"("reference_line_id");
