-- Product catalog: units, products, variants, production issue/output

ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "units_of_measure" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "unit_type" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "units_of_measure_plant_id_symbol_key" ON "units_of_measure"("plant_id", "symbol");
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "products" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category_id" UUID,
  "product_type" TEXT NOT NULL,
  "supply_mode" TEXT NOT NULL,
  "base_unit_id" UUID,
  "track_inventory" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "products_plant_id_sku_key" ON "products"("plant_id", "sku");
CREATE INDEX IF NOT EXISTS "products_plant_id_product_type_idx" ON "products"("plant_id", "product_type");
ALTER TABLE "products" ADD CONSTRAINT "products_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "grade" TEXT,
  "thickness_mm" DECIMAL(10,3),
  "width_mm" DECIMAL(10,2),
  "length_mm" DECIMAL(10,2),
  "diameter_mm" DECIMAL(10,2),
  "finish" TEXT,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "material_master_id" UUID,
  "unit_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_plant_id_sku_key" ON "product_variants"("plant_id", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_material_master_id_key" ON "product_variants"("material_master_id");
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants"("product_id");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bom_headers" ADD COLUMN IF NOT EXISTS "catalog_product_id" UUID;
ALTER TABLE "bom_headers" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "bom_headers" ADD COLUMN IF NOT EXISTS "output_qty" DECIMAL(18,3) NOT NULL DEFAULT 1;
ALTER TABLE "bom_headers" ADD COLUMN IF NOT EXISTS "output_unit_id" UUID;
ALTER TABLE "bom_headers" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_catalog_product_id_fkey" FOREIGN KEY ("catalog_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_output_unit_id_fkey" FOREIGN KEY ("output_unit_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "component_variant_id" UUID;
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "unit_id" UUID;
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_component_variant_id_fkey" FOREIGN KEY ("component_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "product_variant_id" UUID;
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "bom_header_id" UUID;
ALTER TABLE "production_orders" ADD COLUMN IF NOT EXISTS "completed_qty" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_header_id_fkey" FOREIGN KEY ("bom_header_id") REFERENCES "bom_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "production_material_issues" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "production_order_id" UUID NOT NULL,
  "material_master_id" UUID NOT NULL,
  "component_variant_id" UUID,
  "quantity_issued" DECIMAL(18,3) NOT NULL,
  "unit_id" UUID,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_material_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "production_material_issues_production_order_id_idx" ON "production_material_issues"("production_order_id");
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_component_variant_id_fkey" FOREIGN KEY ("component_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "production_outputs" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "production_order_id" UUID NOT NULL,
  "product_variant_id" UUID,
  "material_master_id" UUID NOT NULL,
  "quantity_produced" DECIMAL(18,3) NOT NULL,
  "quantity_rejected" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "unit_id" UUID,
  "produced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "production_outputs_production_order_id_idx" ON "production_outputs"("production_order_id");
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_material_master_id_fkey" FOREIGN KEY ("material_master_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
