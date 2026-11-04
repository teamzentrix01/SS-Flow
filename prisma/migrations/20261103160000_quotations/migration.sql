-- Quotation entity (versioned quotes per lead)

CREATE TABLE IF NOT EXISTS "quotations" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "lead_id" UUID NOT NULL,
  "quotation_number" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "group_id" UUID NOT NULL,
  "parent_quotation_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "valid_until" TIMESTAMPTZ(6) NOT NULL,
  "payment_terms" TEXT,
  "delivery_terms" TEXT,
  "delivery_time_days" INTEGER,
  "freight_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "loading_charges" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 18,
  "tax_breakup" JSONB NOT NULL DEFAULT '{}',
  "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "includes_mtc" BOOLEAN NOT NULL DEFAULT false,
  "third_party_inspection" BOOLEAN NOT NULL DEFAULT false,
  "approval_required" BOOLEAN NOT NULL DEFAULT false,
  "approved_by_id" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL,
  "sent_at" TIMESTAMPTZ(6),
  "sent_via" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quotation_items" (
  "id" UUID NOT NULL,
  "quotation_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "lead_item_id" UUID,
  "product_id" UUID,
  "description" TEXT,
  "grade" TEXT,
  "size" TEXT,
  "qty" DECIMAL(18,3) NOT NULL,
  "uom" TEXT NOT NULL DEFAULT 'PCS',
  "list_rate" DECIMAL(18,2),
  "rate" DECIMAL(18,2) NOT NULL,
  "pricing_basis" TEXT,
  "discount_pct" DECIMAL(8,3),
  "amount" DECIMAL(18,2) NOT NULL,

  CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "quotation_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "quotations_plant_id_quotation_number_key"
  ON "quotations"("plant_id", "quotation_number");
CREATE INDEX IF NOT EXISTS "quotations_lead_id_group_id_version_idx"
  ON "quotations"("lead_id", "group_id", "version");
CREATE INDEX IF NOT EXISTS "quotations_lead_id_status_idx"
  ON "quotations"("lead_id", "status");
CREATE INDEX IF NOT EXISTS "quotations_plant_id_status_valid_until_idx"
  ON "quotations"("plant_id", "status", "valid_until");
CREATE INDEX IF NOT EXISTS "quotation_items_quotation_id_sort_order_idx"
  ON "quotation_items"("quotation_id", "sort_order");
CREATE INDEX IF NOT EXISTS "sales_orders_quotation_id_idx"
  ON "sales_orders"("quotation_id");

ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_plant_id_fkey"
  FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_parent_quotation_id_fkey"
  FOREIGN KEY ("parent_quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotation_items"
  ADD CONSTRAINT "quotation_items_quotation_id_fkey"
  FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotation_items"
  ADD CONSTRAINT "quotation_items_lead_item_id_fkey"
  FOREIGN KEY ("lead_item_id") REFERENCES "lead_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotation_items"
  ADD CONSTRAINT "quotation_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_quotation_id_fkey"
  FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
