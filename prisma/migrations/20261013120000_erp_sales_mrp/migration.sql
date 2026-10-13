-- BOM items extend
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "line_type" TEXT NOT NULL DEFAULT 'metal_sheet';
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "loss_pct" DECIMAL(8,4) NOT NULL DEFAULT 0;
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "dim_length" DECIMAL(18,3);
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "dim_width" DECIMAL(18,3);
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "dim_thickness" DECIMAL(18,3);

-- Sales orders extend
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "order_date" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "promised_date" DATE;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "production_notes" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "on_hold_reason" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "approved_by" UUID;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6);
UPDATE "sales_orders" SET "status" = 'completed' WHERE "status" = 'open';
UPDATE "sales_orders" SET "status" = 'dispatched' WHERE "status" = 'shipped';

-- Sales order items restructure
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "product_id" UUID;
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "qty_ordered" DECIMAL(18,3);
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "qty_produced" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "qty_dispatched" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "tax_pct" DECIMAL(8,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "discount_pct" DECIMAL(8,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "specs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "sales_order_items" ADD COLUMN IF NOT EXISTS "legacy_qty" DECIMAL(18,3);

UPDATE "sales_order_items" SET "legacy_qty" = "qty" WHERE "qty_ordered" IS NULL;
UPDATE "sales_order_items" SET "qty_ordered" = "qty" WHERE "qty_ordered" IS NULL;
UPDATE "sales_order_items" SET "qty_dispatched" = "qty" WHERE "qty_dispatched" = 0 AND "batch_id" IS NOT NULL;
UPDATE "sales_order_items" soi SET "product_id" = mb."material_id"
FROM "material_batches" mb WHERE soi."batch_id" = mb."id" AND soi."product_id" IS NULL;

ALTER TABLE "sales_order_items" ALTER COLUMN "batch_id" DROP NOT NULL;
ALTER TABLE "sales_order_items" DROP COLUMN IF EXISTS "qty";

-- Production / jobs link to sales
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "sales_order_id" UUID;
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "sales_order_item_id" UUID;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "sales_order_item_id" UUID;

ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "linked_requirement_id" UUID;
ALTER TABLE "shipment_items" ADD COLUMN IF NOT EXISTS "sales_order_item_id" UUID;

CREATE TABLE IF NOT EXISTS "sales_order_status_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "remarks" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_order_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "material_requirements" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "sales_order_item_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "gross_qty" DECIMAL(18,3) NOT NULL,
    "scrap_qty" DECIMAL(18,3) NOT NULL,
    "net_qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "calc_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_reservations" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "reference_type" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "sales_order_item_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "material_requests" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "job_id" UUID,
    "sales_order_id" UUID,
    "material_id" UUID NOT NULL,
    "qty_required" DECIMAL(18,3) NOT NULL,
    "qty_fulfilled" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "required_by" DATE,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "material_request_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "remarks" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_request_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_status_events" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "remarks" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_requisitions" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_requisition_items" (
    "id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "requirement_id" UUID,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sales_orders_plant_id_status_promised_date_idx" ON "sales_orders"("plant_id", "status", "promised_date");
CREATE INDEX IF NOT EXISTS "production_orders_sales_order_id_idx" ON "production_orders"("sales_order_id");
CREATE INDEX IF NOT EXISTS "material_requirements_sales_order_id_idx" ON "material_requirements"("sales_order_id");
CREATE INDEX IF NOT EXISTS "material_requirements_material_id_idx" ON "material_requirements"("material_id");
CREATE INDEX IF NOT EXISTS "stock_reservations_reference_type_reference_id_idx" ON "stock_reservations"("reference_type", "reference_id");
CREATE INDEX IF NOT EXISTS "stock_reservations_batch_id_status_idx" ON "stock_reservations"("batch_id", "status");
CREATE INDEX IF NOT EXISTS "material_requests_plant_id_status_idx" ON "material_requests"("plant_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "material_requests_plant_id_number_key" ON "material_requests"("plant_id", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_requisitions_plant_id_number_key" ON "purchase_requisitions"("plant_id", "number");
CREATE INDEX IF NOT EXISTS "sales_order_status_events_order_id_created_at_idx" ON "sales_order_status_events"("order_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "material_request_events_request_id_created_at_idx" ON "material_request_events"("request_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "job_status_events_job_id_created_at_idx" ON "job_status_events"("job_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "purchase_requisition_items_requisition_id_idx" ON "purchase_requisition_items"("requisition_id");

ALTER TABLE "sales_order_status_events" ADD CONSTRAINT "sales_order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_request_events" ADD CONSTRAINT "material_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_status_events" ADD CONSTRAINT "job_status_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_linked_requirement_id_fkey" FOREIGN KEY ("linked_requirement_id") REFERENCES "material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
