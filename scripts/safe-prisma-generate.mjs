/**
 * Windows often locks query_engine-windows.dll.node while Next/dev or the IDE
 * holds the Prisma client. Retry after clearing .prisma/client with fs retries.
 */
import { existsSync, readdirSync, renameSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const clientDir = join(process.cwd(), "node_modules", ".prisma", "client");
const attempts = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A loaded query engine can be renamed on Windows, but not deleted or overwritten.
 * Prisma generate renames a .tmp file onto query_engine-windows.dll.node and fails
 * with EPERM while Next.js (or another Node process) still has the DLL mapped.
 * Park that file under a new name first so the destination path is free.
 */
function parkLockedEngine() {
  if (!existsSync(clientDir)) return;

  for (const name of readdirSync(clientDir)) {
    if (name.startsWith("query_engine-windows.dll.node.locked-")) {
      try {
        unlinkSync(join(clientDir, name));
      } catch {
        // Still mapped by a running process.
      }
      continue;
    }

    const isEngine =
      name === "query_engine-windows.dll.node" ||
      name.startsWith("query_engine-windows.dll.node.tmp") ||
      name.startsWith("query_engine-windows.dll.node.old");
    if (!isEngine) continue;

    const current = join(clientDir, name);
    const parked = join(
      clientDir,
      `query_engine-windows.dll.node.locked-${process.pid}-${Date.now()}`,
    );

    try {
      renameSync(current, parked);
    } catch {
      continue;
    }

    try {
      unlinkSync(parked);
    } catch {
      // The process that loaded the DLL can keep the parked file until it exits.
    }
  }
}

function clearClientDir() {
  parkLockedEngine();
  if (!existsSync(clientDir)) return;
  try {
    rmSync(clientDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
  } catch {
    // Generated JS can stay; the engine path is what must be free.
  }
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
