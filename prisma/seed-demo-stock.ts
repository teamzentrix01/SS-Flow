import { prisma } from "../src/db";
import { seedDemoRawMaterialStockAllPlants } from "../src/modules/inventory/seed-demo-stock";

async function main() {
  const summaries = await seedDemoRawMaterialStockAllPlants();
  for (const summary of summaries) {
    const filled = summary.results.filter((row) => !row.skipped);
    console.log(
      `${summary.plantId}: ${filled.length} raw material(s) topped up at ${summary.locationCode} (${summary.count} total raw SKUs).`,
    );
    for (const row of filled.slice(0, 20)) {
      console.log(`  · ${row.code} +${row.qty} kg (${row.batchNo})`);
    }
    if (filled.length > 20) console.log(`  … and ${filled.length - 20} more`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
