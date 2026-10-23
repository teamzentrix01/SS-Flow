import { prisma } from "../src/db";
import { ensureBusinessCategories } from "../src/modules/masters/ensure-business-categories";

async function main() {
  const report = await ensureBusinessCategories(prisma);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
