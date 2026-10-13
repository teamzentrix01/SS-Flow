import { prisma } from "../src/db";

async function main() {
  const path = await prisma.$queryRaw<{ search_path: string }[]>`
    SHOW search_path
  `;
  console.log("search_path", path);
  try {
    const viaPrisma = await prisma.numberSequence.count();
    console.log("numberSequence count via prisma", viaPrisma);
  } catch (e) {
    console.error("prisma model", e);
  }
  try {
    const raw = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint as c FROM number_sequences
    `;
    console.log("raw unqualified", raw);
  } catch (e) {
    console.error("raw unqualified", (e as Error).message);
  }
  try {
    const raw2 = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint as c FROM ss_flow.number_sequences
    `;
    console.log("raw ss_flow", raw2);
  } catch (e) {
    console.error("raw ss_flow", (e as Error).message);
  }
  await prisma.$disconnect();
}

main();
