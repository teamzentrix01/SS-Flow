-- Add in-transit bucket to stock balances for inter-factory transfers
ALTER TABLE "stock_balances" ADD COLUMN "in_transit_qty" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- Create stock_transfers table for inter-factory stock transfer workflow
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "source_plant_id" UUID NOT NULL,
    "destination_plant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "source_location_id" UUID NOT NULL,
    "dest_location_id" UUID NOT NULL,
    "requested_qty" DECIMAL(18,3) NOT NULL,
    "dispatched_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "received_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejected_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "dispatched_by" UUID,
    "dispatched_at" TIMESTAMPTZ(6),
    "received_by" UUID,
    "received_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_plant_id_fkey" FOREIGN KEY ("source_plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destination_plant_id_fkey" FOREIGN KEY ("destination_plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dest_location_id_fkey" FOREIGN KEY ("dest_location_id") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for common queries
CREATE INDEX "stock_transfers_source_plant_id_status_idx" ON "stock_transfers"("source_plant_id", "status");
CREATE INDEX "stock_transfers_destination_plant_id_status_idx" ON "stock_transfers"("destination_plant_id", "status");
CREATE INDEX "stock_transfers_batch_id_idx" ON "stock_transfers"("batch_id");

-- Add comment explaining the in-transit bucket
COMMENT ON COLUMN "stock_balances"."in_transit_qty" IS 'Quantity dispatched from this location but not yet received at destination (for inter-factory transfers).';

-- Add comment explaining the transfer table
COMMENT ON TABLE "stock_transfers" IS 'Inter-factory stock transfer requests with workflow status tracking.';
