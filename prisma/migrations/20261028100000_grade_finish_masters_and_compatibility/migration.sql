-- CreateTable
CREATE TABLE "grade_masters" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finish_masters" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finish_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_grade_compatibilities" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_grade_compatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_finish_compatibilities" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "finish_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_finish_compatibilities_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "grade_id" UUID;
ALTER TABLE "product_variants" ADD COLUMN "finish_id" UUID;

-- CreateIndex
CREATE INDEX "grade_masters_plant_id_is_active_idx" ON "grade_masters"("plant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "grade_masters_plant_id_normalized_name_key" ON "grade_masters"("plant_id", "normalized_name");

-- CreateIndex
CREATE INDEX "finish_masters_plant_id_is_active_idx" ON "finish_masters"("plant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "finish_masters_plant_id_normalized_name_key" ON "finish_masters"("plant_id", "normalized_name");

-- CreateIndex
CREATE INDEX "product_grade_compatibilities_plant_id_is_active_idx" ON "product_grade_compatibilities"("plant_id", "is_active");

-- CreateIndex
CREATE INDEX "product_grade_compatibilities_product_id_is_active_idx" ON "product_grade_compatibilities"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_grade_compatibilities_product_id_grade_id_key" ON "product_grade_compatibilities"("product_id", "grade_id");

-- CreateIndex
CREATE INDEX "product_finish_compatibilities_plant_id_is_active_idx" ON "product_finish_compatibilities"("plant_id", "is_active");

-- CreateIndex
CREATE INDEX "product_finish_compatibilities_product_id_is_active_idx" ON "product_finish_compatibilities"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_finish_compatibilities_product_id_finish_id_key" ON "product_finish_compatibilities"("product_id", "finish_id");

-- CreateIndex
CREATE INDEX "product_variants_grade_id_idx" ON "product_variants"("grade_id");

-- CreateIndex
CREATE INDEX "product_variants_finish_id_idx" ON "product_variants"("finish_id");

-- AddForeignKey
ALTER TABLE "grade_masters" ADD CONSTRAINT "grade_masters_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_masters" ADD CONSTRAINT "grade_masters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finish_masters" ADD CONSTRAINT "finish_masters_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finish_masters" ADD CONSTRAINT "finish_masters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grade_compatibilities" ADD CONSTRAINT "product_grade_compatibilities_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grade_compatibilities" ADD CONSTRAINT "product_grade_compatibilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grade_compatibilities" ADD CONSTRAINT "product_grade_compatibilities_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grade_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_finish_compatibilities" ADD CONSTRAINT "product_finish_compatibilities_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_finish_compatibilities" ADD CONSTRAINT "product_finish_compatibilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_finish_compatibilities" ADD CONSTRAINT "product_finish_compatibilities_finish_id_fkey" FOREIGN KEY ("finish_id") REFERENCES "finish_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grade_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_finish_id_fkey" FOREIGN KEY ("finish_id") REFERENCES "finish_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
