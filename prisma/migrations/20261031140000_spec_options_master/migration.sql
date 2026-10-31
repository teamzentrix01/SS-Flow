-- CreateTable
CREATE TABLE "spec_options" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "category_id" UUID,
    "product_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spec_options_plant_id_field_name_is_active_idx" ON "spec_options"("plant_id", "field_name", "is_active");

-- CreateIndex
CREATE INDEX "spec_options_plant_id_category_id_idx" ON "spec_options"("plant_id", "category_id");

-- CreateIndex
CREATE INDEX "spec_options_plant_id_product_id_idx" ON "spec_options"("plant_id", "product_id");

-- AddForeignKey
ALTER TABLE "spec_options" ADD CONSTRAINT "spec_options_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_options" ADD CONSTRAINT "spec_options_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_options" ADD CONSTRAINT "spec_options_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_options" ADD CONSTRAINT "spec_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

