-- CreateTable
CREATE TABLE "lead_design_files" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "lead_item_id" UUID,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_design_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_design_files_storage_key_key" ON "lead_design_files"("storage_key");

-- CreateIndex
CREATE INDEX "lead_design_files_plant_id_uploaded_by_id_idx" ON "lead_design_files"("plant_id", "uploaded_by_id");

-- CreateIndex
CREATE INDEX "lead_design_files_lead_item_id_idx" ON "lead_design_files"("lead_item_id");

-- AddForeignKey
ALTER TABLE "lead_design_files" ADD CONSTRAINT "lead_design_files_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_design_files" ADD CONSTRAINT "lead_design_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_design_files" ADD CONSTRAINT "lead_design_files_lead_item_id_fkey" FOREIGN KEY ("lead_item_id") REFERENCES "lead_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
