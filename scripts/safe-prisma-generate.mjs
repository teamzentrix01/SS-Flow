/**
 * Windows often locks query_engine-windows.dll.node while Next/dev or the IDE
 * holds the Prisma client. Retry after clearing .prisma/client with fs retries.
 */
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const clientDir = join(process.cwd(), "node_modules", ".prisma", "client");
const attempts = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearClientDir() {
  if (!existsSync(clientDir)) return;
  rmSync(clientDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
}

async function main() {
  for (let i = 0; i < attempts; i += 1) {
    try {
      clearClientDir();
    } catch {
      // Another process may still hold the DLL; retry generate anyway.
    }

    const result = spawnSync("npx", ["prisma", "generate"], {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });

    if (result.status === 0) {
      process.exit(0);
    }

    const stderr = result.stderr?.toString() ?? "";
    const isLock =
      stderr.includes("EPERM") ||
      stderr.includes("operation not permitted") ||
      result.status === 1;

    if (!isLock && i === attempts - 1) {
      process.exit(result.status ?? 1);
    }

    console.warn(
      `\nPrisma generate failed (attempt ${i + 1}/${attempts}). ` +
        `Stop "next dev" and other Node processes, then retry.\n`,
    );
    await sleep(800 * (i + 1));
  }

  console.error(
    "\nCould not run prisma generate — query_engine DLL is locked.\n" +
      "1. Stop: npm run dev (and any other node processes)\n" +
      "2. Run: npm run db:generate\n" +
      "3. If the project is in OneDrive, pause sync or move the repo locally.\n",
  );
  process.exit(1);
}

await main();
