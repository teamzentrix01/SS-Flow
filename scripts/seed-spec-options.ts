import { prisma } from "../src/db";
import { uuidv7 } from "../src/lib/ids";
import { PVD_COLOUR_OPTIONS } from "../src/lib/domain/material-specifications";

export function normalizeSpecValue(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  const num = Number(trimmed);
  if (!isNaN(num) && isFinite(num)) {
    return String(num);
  }
  return trimmed;
}

const STANDARD_THICKNESSES = [
  "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0", "1.2", "1.5", "2.0", "2.5", "3.0", "4.0", "5.0", "6.0"
];

const STANDARD_DIAMETERS = [
  "50", "80", "100", "125", "150", "175", "200", "225", "250", "300", "350", "400", "450", "500", "600"
];

const STANDARD_WIDTHS = ["1000", "1219", "1250", "1500"];
const STANDARD_LENGTHS = ["2000", "2438", "2500", "3000", "6000"];

async function seed() {
  console.log("Starting Spec Options Master seed...");
  const plants = await prisma.plant.findMany({ select: { id: true, code: true, name: true } });

  const delegate = (prisma as unknown as { specOptionMaster?: {
    findMany: (args: unknown) => Promise<{ id: string; fieldName: string; normalizedValue: string }[]>;
    create: (args: unknown) => Promise<unknown>;
  } }).specOptionMaster;

  if (!delegate) {
    console.error("specOptionMaster delegate not found. Run 'npx prisma migrate deploy' and 'npm run db:generate' first.");
    process.exit(1);
  }

  for (const plant of plants) {
    console.log(`\nProcessing Plant: ${plant.code} (${plant.name})`);

    // Existing spec options
    const existing = await delegate.findMany({ where: { plantId: plant.id } });
    const existingSet = new Set(existing.map((e) => `${e.fieldName}:${e.normalizedValue}`));

    let inserted = 0;

    async function ensureOption(fieldName: string, value: string, unit?: string, productId?: string) {
      const norm = normalizeSpecValue(value);
      const key = `${fieldName}:${norm}`;
      if (!existingSet.has(key)) {
        await delegate!.create({
          data: {
            id: uuidv7(),
            plantId: plant.id,
            fieldName,
            value: value.trim(),
            normalizedValue: norm,
            unit: unit ?? null,
            productId: productId ?? null,
            isActive: true,
          },
        });
        existingSet.add(key);
        inserted++;
      }
    }

    // 1. PVD Colours
    for (const c of PVD_COLOUR_OPTIONS) {
      await ensureOption("pvdColour", c);
    }

    // 2. Standard Thicknesses
    for (const t of STANDARD_THICKNESSES) {
      await ensureOption("thickness", t, "mm");
    }

    // 3. Standard Diameters
    for (const d of STANDARD_DIAMETERS) {
      await ensureOption("diameter", d, "mm");
    }

    // 4. Standard Widths & Lengths
    for (const w of STANDARD_WIDTHS) {
      await ensureOption("width", w, "mm");
    }
    for (const l of STANDARD_LENGTHS) {
      await ensureOption("length", l, "mm");
    }

    // 5. Backfill from existing ProductVariant records
    const variants = await prisma.productVariant.findMany({
      where: { plantId: plant.id },
      select: {
        id: true,
        productId: true,
        thicknessMm: true,
        diameterMm: true,
        widthMm: true,
        lengthMm: true,
        attributes: true,
      },
    });

    for (const v of variants) {
      if (v.thicknessMm != null) {
        await ensureOption("thickness", String(v.thicknessMm), "mm", v.productId);
      }
      if (v.diameterMm != null) {
        await ensureOption("diameter", String(v.diameterMm), "mm", v.productId);
      }
      if (v.widthMm != null) {
        await ensureOption("width", String(v.widthMm), "mm", v.productId);
      }
      if (v.lengthMm != null) {
        await ensureOption("length", String(v.lengthMm), "mm", v.productId);
      }
      if (v.attributes && typeof v.attributes === "object") {
        for (const [key, val] of Object.entries(v.attributes)) {
          if (typeof val === "string" || typeof val === "number") {
            const strVal = String(val).trim();
            if (strVal && ["wireDiameterMm", "cutLengthMm", "innerDiameterMm", "outerDiameterMm", "pvdColour"].includes(key)) {
              await ensureOption(key, strVal, key.endsWith("Mm") ? "mm" : undefined, v.productId);
            }
          }
        }
      }
    }

    console.log(`Ensured ${existingSet.size} spec options (${inserted} newly inserted) for plant ${plant.code}`);
  }

  console.log("\nSpec options seed complete!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

