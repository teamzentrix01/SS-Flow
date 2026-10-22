-- Add intendedPlantId to goods_receipts to track PO's intended factory
-- This allows distinguishing between the PO's intended receiving factory
-- and the actual factory where material was received.

-- Add the column
ALTER TABLE "goods_receipts" ADD COLUMN "intended_plant_id" UUID;

-- Add foreign key constraint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_intended_plant_id_fkey" FOREIGN KEY ("intended_plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for querying by intended plant
CREATE INDEX "goods_receipts_intended_plant_id_idx" ON "goods_receipts"("intended_plant_id");

-- Add a comment explaining the purpose
COMMENT ON COLUMN "goods_receipts"."intended_plant_id" IS 'The plant specified in the original purchase order. May differ from plantId if material was received at a different factory.';
