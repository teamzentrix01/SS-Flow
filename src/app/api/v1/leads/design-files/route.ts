import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { requirePermission, plantIdsForSession } from "@/lib/access";
import { assertSameOrigin, jsonData, jsonError } from "@/lib/api";
import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import {
  DESIGN_FILE_MAX_COUNT,
  designFileExtension,
  isAllowedDesignFile,
} from "@/lib/domain/product-spec-fields";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("lead.manage");
    const plantIds = await plantIdsForSession(session);
    const plantId = plantIds[0] ?? session.userId;

    const formData = await request.formData();
    const files = formData.getAll("files").concat(formData.getAll("file"));
    const uploadFiles = files.filter((item): item is File => item instanceof File && item.size > 0);

    if (uploadFiles.length === 0) {
      throw new AppError(400, "VALIDATION", "No files provided for upload.");
    }
    if (uploadFiles.length > DESIGN_FILE_MAX_COUNT) {
      throw new AppError(
        400,
        "VALIDATION",
        `Maximum ${DESIGN_FILE_MAX_COUNT} files can be uploaded at once.`,
      );
    }

    // Target upload directory inside public for download availability
    const uploadDir = path.join(process.cwd(), "public", "uploads", "leads", "design-files");
    await mkdir(uploadDir, { recursive: true });

    const savedRecords: Array<{
      id: string;
      originalName: string;
      sizeBytes: number;
      mimeType: string;
      url: string;
    }> = [];

    for (const file of uploadFiles) {
      if (!isAllowedDesignFile({ name: file.name, type: file.type, size: file.size })) {
        throw new AppError(
          400,
          "VALIDATION",
          `File "${file.name}" is not supported. Allowed formats: PDF, DXF, DWG, PNG, JPG under 10MB.`,
        );
      }

      const ext = designFileExtension(file.name);
      // Sanitize original filename (remove path traversal components)
      const baseName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileId = uuidv7();
      const storageKey = `${fileId}-${Date.now()}.${ext || "bin"}`;
      const destination = path.join(uploadDir, storageKey);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(destination, buffer);

      const record = await prisma.leadDesignFile.create({
        data: {
          id: fileId,
          plantId,
          uploadedById: session.userId,
          originalName: baseName,
          storageKey,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
      });

      savedRecords.push({
        id: record.id,
        originalName: record.originalName,
        sizeBytes: record.sizeBytes,
        mimeType: record.mimeType,
        url: `/uploads/leads/design-files/${storageKey}`,
      });
    }

    // TODO: Implement orphan file cleanup cron job to delete lead_design_files and physical files where leadItemId is null after 24 hours.

    return jsonData({ files: savedRecords });
  } catch (error) {
    return jsonError(error);
  }
}

