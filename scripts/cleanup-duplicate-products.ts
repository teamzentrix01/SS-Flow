/**
 * SS-Metals ERP - Product Cleanup & Deduplication Script
 *
 * Scans catalog products across plants, identifies duplicate/retired seed records,
 * preserves canonical products & transactions, and safely repoints foreign key references.
 *
 * Performance & Transaction Safety:
 * - Optimized batch database operations to minimize round-trips over remote network.
 * - In-memory pre-indexed lookup maps for variants and compatibilities.
 * - Configured Prisma transaction timeout (60s) and maxWait (15s) per product unit of work.
 * - Independent atomic transaction per duplicate product to guarantee zero partial-merge states.
 *
 * Usage:
 *   Dry-Run (Default, Safe, No mutations):
 *     npx tsx scripts/cleanup-duplicate-products.ts
 *     or
 *     npx tsx scripts/cleanup-duplicate-products.ts --dry-run
 *
 *   Apply (Live execution inside Prisma transactions):
 *     npx tsx scripts/cleanup-duplicate-products.ts --apply
 */

import { prisma } from "../src/db";
import { Prisma } from "@prisma/client";

// Configurable Prisma Interactive Transaction options
const TX_CONFIG = {
  maxWait: 15000, // 15 seconds waiting for connection from pool
  timeout: 60000, // 60 seconds transaction execution ceiling
};

interface CleanupStats {
  totalProductsScanned: number;
  canonicalPreserved: number;
  duplicatesIdentified: number;
  obsoleteSeedIdentified: number;
  eligibleForDeletion: number;
  skippedDueToDependencies: number;
  variantsRepointed: number;
  variantsDeleted: number;
  leadItemsRepointed: number;
  bomHeadersRepointed: number;
  bomItemsRepointed: number;
  productionRecordsRepointed: number;
  compatibilitiesMerged: number;
  specOptionsMerged: number;
}

const CANONICAL_CATALOG_SKUS = [
  "SSM-TRD-COIL",
  "SSM-TRD-SHEET",
  "SSM-TRD-ROD",
  "SSM-TRD-WIRE",
  "SSM-MFG-CIRCLE",
  "SSM-MFG-FARMA",
  "SSM-MFG-LASER-FARMA",
  "SSM-MFG-SEMI-FINISH-UTENSILS",
];

// Mapping of retired / duplicate seed SKUs or names to canonical SKU
const RETIRED_OR_ALIAS_MAP: Record<string, string> = {
  // Wire
  "SSM-TRD-WIRE-PCS": "SSM-TRD-WIRE",
  "WIRE-PCS": "SSM-TRD-WIRE",
  // Sheet
  "SSM-TRD-MIRROR-MATT-PVD": "SSM-TRD-SHEET",
  "MIRROR-MATT-PVD": "SSM-TRD-SHEET",
  // Farma
  "SSM-MFG-FARMA-UTENSILS": "SSM-MFG-FARMA",
  "SSM-MFG-FARMA-UTENSILS-V-JUG-FARMA-CONFIG": "SSM-MFG-FARMA",
  "FARMA-1": "SSM-MFG-FARMA",
  "FARMA": "SSM-MFG-FARMA",
  // Semi-Finish
  "SSM-MFG-SEMI-FINISH-ICE-BUCKET": "SSM-MFG-SEMI-FINISH-UTENSILS",
  "SSM-MFG-SEMI-FINISH-CANISTER": "SSM-MFG-SEMI-FINISH-UTENSILS",
  "SSM-MFG-SEMI-FINISH-JUG": "SSM-MFG-SEMI-FINISH-UTENSILS",
};

// Known demo seeds with no business domain presence
const OBSOLETE_DEMO_SKUS = new Set([
  "BLANK",
  "PIPE",
  "UTENSILS",
  "PRD-2026-00001",
  "PRD-2026-00002",
  "ABC01",
]);

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function toDecimalStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(Number(val));
}

function buildVariantSpecKey(v: {
  gradeId?: string | null;
  finishId?: string | null;
  grade?: string | null;
  finish?: string | null;
  thicknessMm?: unknown;
  widthMm?: unknown;
  lengthMm?: unknown;
  diameterMm?: unknown;
}): string {
  const g = v.gradeId || v.grade?.trim().toLowerCase() || "";
  const f = v.finishId || v.finish?.trim().toLowerCase() || "";
  const t = toDecimalStr(v.thicknessMm);
  const w = toDecimalStr(v.widthMm);
  const l = toDecimalStr(v.lengthMm);
  const d = toDecimalStr(v.diameterMm);
  return `${g}|${f}|${t}|${w}|${l}|${d}`;
}

function getCanonicalFamilyKey(sku: string, name: string): string | null {
  const upperSku = sku.toUpperCase();
  if (RETIRED_OR_ALIAS_MAP[upperSku]) {
    return RETIRED_OR_ALIAS_MAP[upperSku];
  }
  if (CANONICAL_CATALOG_SKUS.includes(upperSku)) {
    return upperSku;
  }
  const norm = normalizeName(name);
  if (norm.includes("laser") && norm.includes("farma")) return "SSM-MFG-LASER-FARMA";
  if (norm.includes("farma")) return "SSM-MFG-FARMA";
  if (norm.includes("circle")) return "SSM-MFG-CIRCLE";
  if (norm.includes("semi finish") || norm.includes("utensil")) return "SSM-MFG-SEMI-FINISH-UTENSILS";
  if (norm.includes("coil")) return "SSM-TRD-COIL";
  if (norm.includes("sheet")) return "SSM-TRD-SHEET";
  if (norm.includes("rod")) return "SSM-TRD-ROD";
  if (norm.includes("wire")) return "SSM-TRD-WIRE";
  return null;
}

async function runCleanup(isDryRun: boolean) {
  console.log("=".repeat(80));
  console.log(`SS-Metals ERP - Product Cleanup & Deduplication (${isDryRun ? "DRY-RUN MODE" : "APPLY MODE"})`);
  console.log("=".repeat(80));

  const stats: CleanupStats = {
    totalProductsScanned: 0,
    canonicalPreserved: 0,
    duplicatesIdentified: 0,
    obsoleteSeedIdentified: 0,
    eligibleForDeletion: 0,
    skippedDueToDependencies: 0,
    variantsRepointed: 0,
    variantsDeleted: 0,
    leadItemsRepointed: 0,
    bomHeadersRepointed: 0,
    bomItemsRepointed: 0,
    productionRecordsRepointed: 0,
    compatibilitiesMerged: 0,
    specOptionsMerged: 0,
  };

  const [hasSpecOptions, hasGradeCompat, hasFinishCompat] = await Promise.all([
    prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass('ss_flow.spec_options') IS NOT NULL AS exists;
    `.then((r) => Boolean(r[0]?.exists)).catch(() => false),
    prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass('ss_flow.product_grade_compatibilities') IS NOT NULL AS exists;
    `.then((r) => Boolean(r[0]?.exists)).catch(() => false),
    prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass('ss_flow.product_finish_compatibilities') IS NOT NULL AS exists;
    `.then((r) => Boolean(r[0]?.exists)).catch(() => false),
  ]);

  const activePlantCode = process.env.ACTIVE_ENTITY_PLANT_CODE?.trim() || "PLANT-01";
  const activePlant = await prisma.plant.findUnique({
    where: { code: activePlantCode },
    select: { id: true, code: true, name: true },
  });
  if (!activePlant) {
    throw new Error(`Configured active entity plant ${activePlantCode} was not found.`);
  }
  const plants = [activePlant];

  console.log(`Found ${plants.length} plant(s) to inspect.\n`);

  for (const plant of plants) {
    console.log(`--- Inspecting Plant: ${plant.name} (${plant.code}) [${plant.id}] ---`);

    const allProducts = await prisma.product.findMany({
      where: { plantId: plant.id },
      include: {
        category: true,
        variants: true,
        gradeCompatibilities: hasGradeCompat,
        finishCompatibilities: hasFinishCompat,
        specOptions: hasSpecOptions,
        leadItems: { select: { id: true } },
        boms: { select: { id: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });

    stats.totalProductsScanned += allProducts.length;

    // Group products by canonical family key or standalone
    const familyGroups = new Map<string, typeof allProducts>();
    const standaloneProducts: typeof allProducts = [];

    for (const prod of allProducts) {
      const familyKey = getCanonicalFamilyKey(prod.sku, prod.name);
      if (familyKey) {
        const group = familyGroups.get(familyKey) || [];
        group.push(prod);
        familyGroups.set(familyKey, group);
      } else {
        standaloneProducts.push(prod);
      }
    }

    // Process Family Groups (Canonical & Duplicates)
    for (const [canonicalSku, group] of familyGroups.entries()) {
      if (group.length === 0) continue;

      // Select canonical record:
      // Priority 1: exact SKU match to canonicalSku and active
      // Priority 2: exact SKU match to canonicalSku
      // Priority 3: active status with highest number of variants
      // Priority 4: most variants
      const sorted = [...group].sort((a, b) => {
        const aIsExact = a.sku.toUpperCase() === canonicalSku ? 1 : 0;
        const bIsExact = b.sku.toUpperCase() === canonicalSku ? 1 : 0;
        if (aIsExact !== bIsExact) return bIsExact - aIsExact;

        const aActive = a.isActive ? 1 : 0;
        const bActive = b.isActive ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        const aHasActiveVariant = a.variants.some((variant) => variant.isActive) ? 1 : 0;
        const bHasActiveVariant = b.variants.some((variant) => variant.isActive) ? 1 : 0;
        if (aHasActiveVariant !== bHasActiveVariant) return bHasActiveVariant - aHasActiveVariant;

        return b.variants.length - a.variants.length;
      });

      const canonicalProduct = sorted[0];
      const duplicates = sorted.slice(1);

      // Ensure the surviving catalog entry remains visible to lead creation.
      // The lead catalog only returns active products and active variants.
      if (!canonicalProduct.isActive && duplicates.some((product) => product.isActive && product.variants.some((variant) => variant.isActive))) {
        canonicalProduct.isActive = true;
        if (!isDryRun) {
          await prisma.product.update({ where: { id: canonicalProduct.id }, data: { isActive: true } });
        }
      }

      stats.canonicalPreserved++;
      console.log(
        `  [PRESERVE] Canonical: "${canonicalProduct.name}" (${canonicalProduct.sku}) [ID: ${canonicalProduct.id}] - ${canonicalProduct.variants.length} variant(s), Active: ${canonicalProduct.isActive}`
      );

      // Pre-index canonical properties in memory to avoid repetitive DB lookups
      const canonicalVariantBySku = new Map<string, (typeof canonicalProduct.variants)[number]>();
      const canonicalVariantBySpecs = new Map<string, (typeof canonicalProduct.variants)[number]>();
      for (const cv of canonicalProduct.variants) {
        if (cv.sku) canonicalVariantBySku.set(cv.sku.toUpperCase(), cv);
        const specKey = buildVariantSpecKey(cv);
        if (specKey !== "|||||") {
          canonicalVariantBySpecs.set(specKey, cv);
        }
      }

      const canonicalGradeIds = new Set(
        (canonicalProduct.gradeCompatibilities ?? []).map((gc) => gc.gradeId)
      );
      const canonicalFinishIds = new Set(
        (canonicalProduct.finishCompatibilities ?? []).map((fc) => fc.finishId)
      );
      const canonicalSpecOptionKeys = new Set(
        (canonicalProduct.specOptions ?? []).map((so) => `${so.fieldName}:${so.value}`)
      );

      for (const dup of duplicates) {
        stats.duplicatesIdentified++;
        console.log(
          `    -> Duplicate identified: "${dup.name}" (${dup.sku}) [ID: ${dup.id}] - ${dup.variants.length} variant(s), ${dup.leadItems.length} LeadItem(s), ${dup.boms.length} BomHeader(s)`
        );

        // Pre-compute variant merge plan in memory
        const matchedVariantPairs: { dupVariantId: string; matchVariantId: string }[] = [];
        const redundantVariantIds: string[] = [];
        const unmatchedVariantIds: string[] = [];

        for (const dVariant of dup.variants) {
          const matchBySku = dVariant.sku ? canonicalVariantBySku.get(dVariant.sku.toUpperCase()) : undefined;
          const matchBySpec = canonicalVariantBySpecs.get(buildVariantSpecKey(dVariant));
          const match = matchBySku || matchBySpec;

          if (match) {
            matchedVariantPairs.push({
              dupVariantId: dVariant.id,
              matchVariantId: match.id,
            });
            redundantVariantIds.push(dVariant.id);
          } else {
            unmatchedVariantIds.push(dVariant.id);
          }
        }

        // Pre-compute grade compatibility plan in memory
        const gradeCompatToDelete: string[] = [];
        const gradeCompatToRepoint: string[] = [];
        if (hasGradeCompat) {
          for (const gc of dup.gradeCompatibilities ?? []) {
            if (canonicalGradeIds.has(gc.gradeId)) {
              gradeCompatToDelete.push(gc.id);
            } else {
              gradeCompatToRepoint.push(gc.id);
              canonicalGradeIds.add(gc.gradeId);
            }
          }
        }

        // Pre-compute finish compatibility plan in memory
        const finishCompatToDelete: string[] = [];
        const finishCompatToRepoint: string[] = [];
        if (hasFinishCompat) {
          for (const fc of dup.finishCompatibilities ?? []) {
            if (canonicalFinishIds.has(fc.finishId)) {
              finishCompatToDelete.push(fc.id);
            } else {
              finishCompatToRepoint.push(fc.id);
              canonicalFinishIds.add(fc.finishId);
            }
          }
        }

        // Pre-compute spec options plan in memory
        const specOptionsToDelete: string[] = [];
        const specOptionsToRepoint: string[] = [];
        if (hasSpecOptions) {
          for (const so of dup.specOptions ?? []) {
            const key = `${so.fieldName}:${so.value}`;
            if (canonicalSpecOptionKeys.has(key)) {
              specOptionsToDelete.push(so.id);
            } else {
              specOptionsToRepoint.push(so.id);
              canonicalSpecOptionKeys.add(key);
            }
          }
        }

        if (!isDryRun) {
          await prisma.$transaction(
            async (tx) => {
              // 1. Repoint LeadItems referencing the duplicate product
              if (dup.leadItems.length > 0) {
                const updated = await tx.leadItem.updateMany({
                  where: { parentProductId: dup.id },
                  data: { parentProductId: canonicalProduct.id },
                });
                stats.leadItemsRepointed += updated.count;
              }

              // 2. Repoint BomHeaders referencing the duplicate product
              if (dup.boms.length > 0) {
                const updated = await tx.bomHeader.updateMany({
                  where: { catalogProductId: dup.id },
                  data: { catalogProductId: canonicalProduct.id },
                });
                stats.bomHeadersRepointed += updated.count;
              }

              // 3. Batch Grade Compatibilities (Delete redundant, repoint unique)
              if (hasGradeCompat) {
                if (gradeCompatToDelete.length > 0) {
                  await tx.productGradeCompatibility.deleteMany({
                    where: { id: { in: gradeCompatToDelete } },
                  });
                  stats.compatibilitiesMerged += gradeCompatToDelete.length;
                }
                if (gradeCompatToRepoint.length > 0) {
                  await tx.productGradeCompatibility.updateMany({
                    where: { id: { in: gradeCompatToRepoint } },
                    data: { productId: canonicalProduct.id },
                  });
                  stats.compatibilitiesMerged += gradeCompatToRepoint.length;
                }
              }

              // 4. Batch Finish Compatibilities (Delete redundant, repoint unique)
              if (hasFinishCompat) {
                if (finishCompatToDelete.length > 0) {
                  await tx.productFinishCompatibility.deleteMany({
                    where: { id: { in: finishCompatToDelete } },
                  });
                  stats.compatibilitiesMerged += finishCompatToDelete.length;
                }
                if (finishCompatToRepoint.length > 0) {
                  await tx.productFinishCompatibility.updateMany({
                    where: { id: { in: finishCompatToRepoint } },
                    data: { productId: canonicalProduct.id },
                  });
                  stats.compatibilitiesMerged += finishCompatToRepoint.length;
                }
              }

              // 5. Batch Spec Options (Delete redundant, repoint unique)
              if (hasSpecOptions) {
                if (specOptionsToDelete.length > 0) {
                  await tx.specOptionMaster.deleteMany({
                    where: { id: { in: specOptionsToDelete } },
                  });
                  stats.specOptionsMerged += specOptionsToDelete.length;
                }
                if (specOptionsToRepoint.length > 0) {
                  await tx.specOptionMaster.updateMany({
                    where: { id: { in: specOptionsToRepoint } },
                    data: { productId: canonicalProduct.id },
                  });
                  stats.specOptionsMerged += specOptionsToRepoint.length;
                }
              }

              // 6. Repoint transaction references for matched variants
              for (const { dupVariantId, matchVariantId } of matchedVariantPairs) {
                const li = await tx.leadItem.updateMany({
                  where: { productVariantId: dupVariantId },
                  data: { productVariantId: matchVariantId },
                });
                stats.leadItemsRepointed += li.count;

                const bi = await tx.bomItem.updateMany({
                  where: { componentVariantId: dupVariantId },
                  data: { componentVariantId: matchVariantId },
                });
                stats.bomItemsRepointed += bi.count;

                const po = await tx.productionOrder.updateMany({
                  where: { productVariantId: dupVariantId },
                  data: { productVariantId: matchVariantId },
                });
                const pmi = await tx.productionMaterialIssue.updateMany({
                  where: { componentVariantId: dupVariantId },
                  data: { componentVariantId: matchVariantId },
                });
                const pout = await tx.productionOutput.updateMany({
                  where: { productVariantId: dupVariantId },
                  data: { productVariantId: matchVariantId },
                });
                stats.productionRecordsRepointed += po.count + pmi.count + pout.count;
              }

              // 7. Delete redundant duplicate variants in batch
              if (redundantVariantIds.length > 0) {
                await tx.productVariant.deleteMany({
                  where: { id: { in: redundantVariantIds } },
                });
                stats.variantsDeleted += redundantVariantIds.length;
              }

              // 8. Repoint unique variants to canonical product in batch
              if (unmatchedVariantIds.length > 0) {
                await tx.productVariant.updateMany({
                  where: { id: { in: unmatchedVariantIds } },
                  data: { productId: canonicalProduct.id },
                });
                stats.variantsRepointed += unmatchedVariantIds.length;
              }

              // 9. Delete the duplicate product record
              await tx.product.delete({ where: { id: dup.id } });
              stats.eligibleForDeletion++;
            },
            TX_CONFIG
          );
        } else {
          // Dry Run stats tracking
          stats.eligibleForDeletion++;
          stats.variantsDeleted += redundantVariantIds.length;
          stats.variantsRepointed += unmatchedVariantIds.length;
          stats.leadItemsRepointed += dup.leadItems.length;
          stats.bomHeadersRepointed += dup.boms.length;
          stats.compatibilitiesMerged +=
            gradeCompatToDelete.length +
            gradeCompatToRepoint.length +
            finishCompatToDelete.length +
            finishCompatToRepoint.length;
          stats.specOptionsMerged += specOptionsToDelete.length + specOptionsToRepoint.length;
        }
      }
    }

    // Process Standalone Products (Check for obsolete demo seeds)
    for (const prod of standaloneProducts) {
      const isDemo = OBSOLETE_DEMO_SKUS.has(prod.sku.toUpperCase());
      if (isDemo) {
        stats.obsoleteSeedIdentified++;

        const txCount = prod.leadItems.length + prod.boms.length;
        const variantIds = prod.variants.map((v) => v.id);

        const [bomItemUsage, prodOrderUsage] = await Promise.all([
          variantIds.length > 0
            ? prisma.bomItem.count({ where: { componentVariantId: { in: variantIds } } })
            : 0,
          variantIds.length > 0
            ? prisma.productionOrder.count({ where: { productVariantId: { in: variantIds } } })
            : 0,
        ]);

        if (txCount === 0 && bomItemUsage === 0 && prodOrderUsage === 0) {
          console.log(
            `    -> Obsolete Seed Product eligible for deletion: "${prod.name}" (${prod.sku}) [ID: ${prod.id}]`
          );
          if (!isDryRun) {
            await prisma.$transaction(
              async (tx) => {
                if (prod.variants.length > 0) {
                  await tx.productVariant.deleteMany({ where: { productId: prod.id } });
                }
                await tx.product.delete({ where: { id: prod.id } });
              },
              TX_CONFIG
            );
          }
          stats.eligibleForDeletion++;
        } else {
          console.log(
            `    [SKIP] Obsolete Seed Product has active transactions, preserved: "${prod.name}" (${prod.sku}) [ID: ${prod.id}]`
          );
          stats.skippedDueToDependencies++;
          stats.canonicalPreserved++;
        }
      } else {
        // Genuine custom/other product
        stats.canonicalPreserved++;
      }
    }

    console.log();
  }

  // Final Summary Output
  console.log("=".repeat(80));
  console.log("CLEANUP & DEDUPLICATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Execution Mode               : ${isDryRun ? "DRY-RUN (Simulated, no changes made)" : "APPLIED (Live changes committed)"}`);
  console.log(`Total Products Scanned       : ${stats.totalProductsScanned}`);
  console.log(`Products Preserved (Valid)   : ${stats.canonicalPreserved}`);
  console.log(`Duplicate Products Found     : ${stats.duplicatesIdentified}`);
  console.log(`Obsolete Demo Seeds Found    : ${stats.obsoleteSeedIdentified}`);
  console.log(`Products Cleaned / Deleted   : ${stats.eligibleForDeletion}`);
  console.log(`Products Skipped (In Use)    : ${stats.skippedDueToDependencies}`);
  console.log(`Variants Merged / Repointed  : ${stats.variantsRepointed}`);
  console.log(`Redundant Variants Removed   : ${stats.variantsDeleted}`);
  console.log(`LeadItems Safely Repointed   : ${stats.leadItemsRepointed}`);
  console.log(`BOM Headers Safely Repointed : ${stats.bomHeadersRepointed}`);
  console.log(`Compatibility Links Merged   : ${stats.compatibilitiesMerged}`);
  console.log(`Spec Options Master Merged   : ${stats.specOptionsMerged}`);
  console.log("=".repeat(80));
  if (isDryRun) {
    console.log("Dry-run complete. No database records were modified.");
    console.log("To apply these changes, run with the --apply flag.");
  } else {
    console.log("Cleanup successfully applied inside transactional boundaries.");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = !isApply || args.includes("--dry-run");

  await runCleanup(isDryRun);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Cleanup script failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
