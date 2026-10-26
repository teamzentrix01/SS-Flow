import { prisma } from "../src/db";
import { uuidv7 } from "../src/lib/ids";

export function normalizeMasterName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const STANDARD_GRADES = [
  "SS 202",
  "SS 304",
  "SS 316",
  "SS 316L",
  "201",
  "304",
  "316",
  "430",
  "IS2062",
];

const STANDARD_FINISHES = [
  "2B",
  "2D",
  "BA",
  "No. 4",
  "Mirror",
  "Matt",
  "Satin",
  "Hairline",
  "PVD",
];

async function backfill() {
  console.log("Starting Grade & Finish Masters and Compatibility backfill...");
  const plants = await prisma.plant.findMany({ select: { id: true, code: true, name: true } });

  for (const plant of plants) {
    console.log(`\nProcessing Plant: ${plant.code} (${plant.name})`);

    // 1. Gather all existing grades from ProductVariants and MaterialMasters in this plant
    const variants = await prisma.productVariant.findMany({
      where: { plantId: plant.id },
      select: { id: true, productId: true, grade: true, finish: true },
    });
    const materials = await prisma.materialMaster.findMany({
      where: { plantId: plant.id },
      select: { id: true, grade: true },
    });

    const distinctGrades = new Set<string>();
    for (const g of STANDARD_GRADES) distinctGrades.add(g);
    for (const v of variants) if (v.grade?.trim()) distinctGrades.add(v.grade.trim());
    for (const m of materials) if (m.grade?.trim()) distinctGrades.add(m.grade.trim());

    const distinctFinishes = new Set<string>();
    for (const f of STANDARD_FINISHES) distinctFinishes.add(f);
    for (const v of variants) if (v.finish?.trim()) distinctFinishes.add(v.finish.trim());

    // Map normalized name -> GradeMaster
    const gradeByNorm = new Map<string, { id: string; name: string }>();
    const existingGrades = await prisma.gradeMaster.findMany({ where: { plantId: plant.id } });
    for (const eg of existingGrades) {
      gradeByNorm.set(eg.normalizedName, { id: eg.id, name: eg.name });
    }

    for (const gradeName of distinctGrades) {
      const norm = normalizeMasterName(gradeName);
      if (!gradeByNorm.has(norm)) {
        const created = await prisma.gradeMaster.create({
          data: {
            id: uuidv7(),
            plantId: plant.id,
            name: gradeName,
            normalizedName: norm,
            isActive: true,
          },
        });
        gradeByNorm.set(norm, { id: created.id, name: created.name });
      }
    }
    console.log(`Ensured ${gradeByNorm.size} grades for plant ${plant.code}`);

    // Map normalized name -> FinishMaster
    const finishByNorm = new Map<string, { id: string; name: string }>();
    const existingFinishes = await prisma.finishMaster.findMany({ where: { plantId: plant.id } });
    for (const ef of existingFinishes) {
      finishByNorm.set(ef.normalizedName, { id: ef.id, name: ef.name });
    }

    for (const finishName of distinctFinishes) {
      const norm = normalizeMasterName(finishName);
      if (!finishByNorm.has(norm)) {
        const created = await prisma.finishMaster.create({
          data: {
            id: uuidv7(),
            plantId: plant.id,
            name: finishName,
            normalizedName: norm,
            isActive: true,
          },
        });
        finishByNorm.set(norm, { id: created.id, name: created.name });
      }
    }
    console.log(`Ensured ${finishByNorm.size} finishes for plant ${plant.code}`);

    // 2. Link variants to gradeId and finishId
    let linkedGrades = 0;
    let linkedFinishes = 0;
    for (const v of variants) {
      let gradeId: string | undefined = undefined;
      let finishId: string | undefined = undefined;

      if (v.grade?.trim()) {
        const g = gradeByNorm.get(normalizeMasterName(v.grade));
        if (g) gradeId = g.id;
      }
      if (v.finish?.trim()) {
        const f = finishByNorm.get(normalizeMasterName(v.finish));
        if (f) finishId = f.id;
      }

      if (gradeId || finishId) {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: {
            ...(gradeId ? { gradeId } : {}),
            ...(finishId ? { finishId } : {}),
          },
        });
        if (gradeId) linkedGrades++;
        if (finishId) linkedFinishes++;
      }
    }
    console.log(`Linked ${linkedGrades} variant grade references, ${linkedFinishes} variant finish references`);

    // 3. Create product compatibility mappings based on variants
    let gradeCompats = 0;
    let finishCompats = 0;
    for (const v of variants) {
      if (v.grade?.trim()) {
        const g = gradeByNorm.get(normalizeMasterName(v.grade));
        if (g) {
          const existing = await prisma.productGradeCompatibility.findUnique({
            where: { productId_gradeId: { productId: v.productId, gradeId: g.id } },
          });
          if (!existing) {
            await prisma.productGradeCompatibility.create({
              data: {
                id: uuidv7(),
                plantId: plant.id,
                productId: v.productId,
                gradeId: g.id,
                isActive: true,
              },
            });
            gradeCompats++;
          }
        }
      }

      if (v.finish?.trim()) {
        const f = finishByNorm.get(normalizeMasterName(v.finish));
        if (f) {
          const existing = await prisma.productFinishCompatibility.findUnique({
            where: { productId_finishId: { productId: v.productId, finishId: f.id } },
          });
          if (!existing) {
            await prisma.productFinishCompatibility.create({
              data: {
                id: uuidv7(),
                plantId: plant.id,
                productId: v.productId,
                finishId: f.id,
                isActive: true,
              },
            });
            finishCompats++;
          }
        }
      }
    }
    console.log(`Created ${gradeCompats} grade compatibilities and ${finishCompats} finish compatibilities`);
  }

  console.log("\nBackfill complete!");
}

backfill()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
