import path from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { requireAnyPermission, requirePermission, plantIdsForSession } from "@/lib/access";
import { assertSameOrigin, jsonData, jsonError } from "@/lib/api";
import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import {
  DESIGN_FILE_MAX_BYTES,
  DESIGN_FILE_MAX_COUNT,
  designFileExtension,
  isAllowedDesignFile,
} from "@/lib/domain/product-spec-fields";

export const runtime = "nodejs";

function localDesignStoragePath() {
  return path.join(process.cwd(), ".data", "lead-design-files");
}

function legacyPublicDesignStoragePath() {
  return path.join(process.cwd(), "public", "uploads", "leads", "design-files");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("lead.manage");
    const plantIds = await plantIdsForSession(session);
    const plantId = plantIds[0];
    if (!plantId) throw new AppError(403, "FORBIDDEN", "No plant is assigned to this user.");

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    const maxRequestBytes = DESIGN_FILE_MAX_COUNT * (DESIGN_FILE_MAX_BYTES + 1024);
    if (contentLength > maxRequestBytes) {
      throw new AppError(413, "VALIDATION", "Upload is too large. Maximum total size is 50 MB.");
    }

    const formData = await request.formData();
    const files = formData.getAll("files").concat(formData.getAll("file"));
    const uploadFiles = files.filter(
      (item): item is File => typeof item !== "string" && item.size > 0,
    );

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

    const invalidFile = uploadFiles.find(
      (file) => !isAllowedDesignFile({ name: file.name, type: file.type, size: file.size }),
    );
    if (invalidFile) {
      throw new AppError(
        400,
        "VALIDATION",
        `File "${invalidFile.name}" is not supported. Allowed formats: PDF, DXF, DWG, PNG, JPG, WebP under 10MB.`,
      );
    }

    // Keep customer drawings on local private disk; downloads use this authenticated route.
    const uploadDir = localDesignStoragePath();
    await mkdir(uploadDir, { recursive: true });

    const savedRecords: Array<{
      id: string;
      originalName: string;
      sizeBytes: number;
      mimeType: string;
      url: string;
    }> = [];

    const writtenFiles: string[] = [];
    try {
      for (const file of uploadFiles) {
        const ext = designFileExtension(file.name);
        // Sanitize original filename (remove path traversal components)
        const baseName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileId = uuidv7();
        const storageKey = `${fileId}-${Date.now()}.${ext || "bin"}`;
        const destination = path.join(uploadDir, storageKey);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(destination, buffer, { flag: "wx" });
        writtenFiles.push(destination);

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
          url: `/api/v1/leads/design-files?id=${record.id}`,
        });
      }
    } catch (error) {
      await prisma.leadDesignFile
        .deleteMany({ where: { id: { in: savedRecords.map((file) => file.id) } } })
        .catch(() => undefined);
      await Promise.all(writtenFiles.map((filePath) => unlink(filePath).catch(() => undefined)));
      throw error;
    }

    // TODO: Implement orphan file cleanup cron job to delete lead_design_files and physical files where leadItemId is null after 24 hours.

    return jsonData({ files: savedRecords });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("lead.manage");
    const plantIds = await plantIdsForSession(session);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new AppError(400, "VALIDATION", "Design file ID is required.");

    const record = await prisma.leadDesignFile.findFirst({
      where: {
        id,
        plantId: { in: plantIds },
        uploadedById: session.userId,
        leadItemId: null,
      },
    });
    if (!record) throw new AppError(404, "NOT_FOUND", "Unattached design file not found.");

    await prisma.leadDesignFile.delete({ where: { id: record.id } });
    const storageKey = path.basename(record.storageKey);
    await Promise.all([
      unlink(path.join(localDesignStoragePath(), storageKey)).catch(() => undefined),
      unlink(path.join(legacyPublicDesignStoragePath(), storageKey)).catch(() => undefined),
    ]);
    return jsonData({ id: record.id, deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAnyPermission("lead.manage", "lead.view");
    const plantIds = await plantIdsForSession(session);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new AppError(400, "VALIDATION", "Design file ID is required.");

    const record = await prisma.leadDesignFile.findFirst({
      where: { id, plantId: { in: plantIds } },
    });
    if (!record) throw new AppError(404, "NOT_FOUND", "Design file not found.");

    const storageKey = path.basename(record.storageKey);
    let contents: Buffer;
    try {
      contents = await readFile(path.join(localDesignStoragePath(), storageKey));
    } catch {
      // Continue serving files uploaded by the previous local-public storage version.
      contents = await readFile(path.join(legacyPublicDesignStoragePath(), storageKey));
    }
    const filename = encodeURIComponent(record.originalName);
    return new Response(new Uint8Array(contents), {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Length": String(record.sizeBytes),
        "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

