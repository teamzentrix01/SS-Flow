ALTER TABLE "product_variants" ADD COLUMN "display_name" TEXT;
ALTER TABLE "lead_items" ADD COLUMN "parent_product_id" UUID;

ALTER TABLE "lead_items"
ADD CONSTRAINT "lead_items_parent_product_id_fkey"
FOREIGN KEY ("parent_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "lead_items_parent_product_id_idx" ON "lead_items"("parent_product_id");
